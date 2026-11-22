-- 80/20 AI DIALER: Email Automation Database Schema Migration
-- Migration: 20261010000002_email_automation_schema.sql
-- Covers Resend email follow-up tables, indexes, RLS, and lease-claim stored procedures

-- 1. Email Automation Settings
CREATE TABLE IF NOT EXISTS email_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  paused BOOLEAN NOT NULL DEFAULT false,
  hourly_send_limit INTEGER NOT NULL DEFAULT 30,
  sender_name TEXT NOT NULL DEFAULT 'RM Group',
  company_blurb TEXT NOT NULL DEFAULT '',
  inbound_configured BOOLEAN NOT NULL DEFAULT false,
  sender_domain_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Email Suppressions (Unsubscribes, Bounces, Complaints, Stop-All)
CREATE TABLE IF NOT EXISTS email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual', 'stop_all')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- 3. Email Jobs (Follow-up generation & dispatch lifecycle)
CREATE TABLE IF NOT EXISTS email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE UNIQUE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sending', 'retry', 'suppressed', 'accepted', 'delivered', 'bounced', 'complained', 'failed')),
  qualification JSONB DEFAULT NULL,
  eligibility_reasons JSONB DEFAULT '[]'::jsonb,
  draft JSONB DEFAULT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ DEFAULT NULL,
  locked_at TIMESTAMPTZ DEFAULT NULL,
  last_error TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

-- 4. Email Messages (Rendered and queued emails dispatched through Resend)
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES email_jobs(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT DEFAULT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('qualification_follow_up', 'requested_information', 'general_follow_up')),
  resend_id TEXT DEFAULT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'accepted', 'delivered', 'bounced', 'complained', 'failed', 'retry')),
  last_error TEXT DEFAULT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

-- 5. Email Events (Resend Webhook delivery events)
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
  job_id UUID REFERENCES email_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider_event_id TEXT DEFAULT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Email Audit Log
CREATE TABLE IF NOT EXISTS email_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  job_id UUID REFERENCES email_jobs(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_email_jobs_org_status ON email_jobs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_email_jobs_next_attempt ON email_jobs (next_attempt_at) WHERE status IN ('queued', 'retry', 'pending');
CREATE INDEX IF NOT EXISTS idx_email_jobs_call_id ON email_jobs (call_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_org_created ON email_messages (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_lead_campaign ON email_messages (organization_id, lead_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_resend_id ON email_messages (resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_events_org_type ON email_events (organization_id, event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events (message_id);
CREATE INDEX IF NOT EXISTS idx_email_audit_call ON email_audit_log (call_id);

-- RPC Function: claim_email_job
-- Safely acquires an email job lease preventing double sends in concurrent environments
CREATE OR REPLACE FUNCTION claim_email_job(
  target_id TEXT,
  call_ready BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_target_uuid UUID;
BEGIN
  BEGIN
    v_target_uuid := target_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'terminal';
  END;

  SELECT * INTO v_job
  FROM email_jobs
  WHERE id = v_target_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'terminal';
  END IF;

  -- If job is terminal, do not re-claim
  IF v_job.status IN ('accepted', 'delivered', 'suppressed', 'bounced', 'complained', 'failed') THEN
    RETURN 'terminal';
  END IF;

  -- If currently claimed and lease has not expired (5 min timeout)
  IF v_job.locked_at IS NOT NULL AND v_job.locked_at > now() - interval '5 minutes' AND v_job.status = 'sending' THEN
    RETURN 'busy';
  END IF;

  -- If call outcomes / transcript analysis not ready yet
  IF NOT call_ready THEN
    RETURN 'waiting';
  END IF;

  -- Successfully claim lease
  UPDATE email_jobs
  SET
    status = 'sending',
    locked_at = now(),
    attempts = attempts + 1,
    updated_at = now()
  WHERE id = v_target_uuid;

  RETURN 'claimed';
END;
$$;

-- RPC Function: redact_expired_email_bodies
-- Compliance / data retention: cleans body content of older emails
CREATE OR REPLACE FUNCTION redact_expired_email_bodies()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_messages
  SET
    html_body = '[REDACTED FOR RETENTION COMPLIANCE]',
    text_body = '[REDACTED FOR RETENTION COMPLIANCE]',
    updated_at = now()
  WHERE created_at < now() - interval '30 days'
    AND status IN ('delivered', 'bounced', 'complained', 'failed')
    AND html_body <> '[REDACTED FOR RETENTION COMPLIANCE]';
END;
$$;

-- Enable Row Level Security
ALTER TABLE email_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (for server-side follow-up processor)
CREATE POLICY "Service role full access on email_automation_settings" ON email_automation_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on email_suppressions" ON email_suppressions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on email_jobs" ON email_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on email_messages" ON email_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on email_events" ON email_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on email_audit_log" ON email_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated user tenant isolation policies
CREATE POLICY "Tenant isolation for email_automation_settings" ON email_automation_settings FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for email_suppressions" ON email_suppressions FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for email_jobs" ON email_jobs FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for email_messages" ON email_messages FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for email_events" ON email_events FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for email_audit_log" ON email_audit_log FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());

