-- Migration: 20261014200002_email_automation_schema.sql
-- Description: Additive email follow-up tables, indexes, RLS, and lease-claim procedures.
-- References verified remote tables: organizations(id), call_sessions(id), leads(id), campaigns(id).
-- Timestamped after remote migration: 20261014192444_phase4_call_audit

-- 1. Email Automation Settings
CREATE TABLE IF NOT EXISTS public.email_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
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
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual', 'stop_all')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- 3. Email Jobs (Follow-up generation & dispatch lifecycle)
CREATE TABLE IF NOT EXISTS public.email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
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
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.email_jobs(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  call_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
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
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.email_messages(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.email_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider_event_id TEXT DEFAULT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Email Audit Log
CREATE TABLE IF NOT EXISTS public.email_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  call_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.email_jobs(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_email_jobs_poll ON public.email_jobs (organization_id, status, next_attempt_at) WHERE status IN ('queued', 'retry');
CREATE INDEX IF NOT EXISTS idx_email_jobs_lead ON public.email_jobs (lead_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON public.email_messages (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_email_events_message ON public.email_events (message_id);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_lookup ON public.email_suppressions (organization_id, email);

-- Enable Row Level Security
ALTER TABLE public.email_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_audit_log ENABLE ROW LEVEL SECURITY;

-- Service Role Policies (Full access for server worker/queues)
CREATE POLICY "service_role_email_settings" ON public.email_automation_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_email_suppressions" ON public.email_suppressions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_email_jobs" ON public.email_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_email_messages" ON public.email_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_email_events" ON public.email_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_email_audit" ON public.email_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated User Tenant Read Policies
CREATE POLICY "email_settings_select" ON public.email_automation_settings FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'org.manage') OR private.has_permission(organization_id, 'campaigns.read'));

CREATE POLICY "email_suppressions_select" ON public.email_suppressions FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'campaigns.read'));

CREATE POLICY "email_jobs_select" ON public.email_jobs FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'campaigns.read'));

CREATE POLICY "email_messages_select" ON public.email_messages FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'campaigns.read'));

CREATE POLICY "email_events_select" ON public.email_events FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'audit.read'));

CREATE POLICY "email_audit_select" ON public.email_audit_log FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'audit.read'));

-- Stored Procedures for atomic queue consumption and privacy redaction
CREATE OR REPLACE FUNCTION public.claim_email_job(
  p_org_id UUID,
  p_lease_duration_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  job_id UUID,
  call_id UUID,
  lead_id UUID,
  campaign_id UUID,
  idempotency_key TEXT,
  qualification JSONB,
  draft JSONB,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  SELECT id INTO v_job_id
  FROM public.email_jobs
  WHERE organization_id = p_org_id
    AND status IN ('queued', 'retry')
    AND (next_attempt_at IS NULL OR next_attempt_at <= clock_timestamp())
    AND (locked_at IS NULL OR locked_at <= clock_timestamp() - (p_lease_duration_seconds || ' seconds')::interval)
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.email_jobs
  SET
    status = 'sending',
    locked_at = clock_timestamp(),
    attempts = attempts + 1,
    updated_at = clock_timestamp()
  WHERE id = v_job_id;

  RETURN QUERY
  SELECT
    j.id,
    j.call_id,
    j.lead_id,
    j.campaign_id,
    j.idempotency_key,
    j.qualification,
    j.draft,
    j.attempts
  FROM public.email_jobs j
  WHERE j.id = v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_expired_email_bodies(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH redacted AS (
    UPDATE public.email_messages
    SET
      html_body = '[REDACTED_PURSUANT_TO_RETENTION_POLICY]',
      text_body = '[REDACTED_PURSUANT_TO_RETENTION_POLICY]',
      updated_at = clock_timestamp()
    WHERE created_at < clock_timestamp() - (p_retention_days || ' days')::interval
      AND html_body NOT LIKE '[REDACTED%'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM redacted;

  RETURN v_count;
END;
$$;
