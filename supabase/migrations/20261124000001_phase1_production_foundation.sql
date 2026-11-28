-- ============================================================================
-- RM AI DIALER: Phase 1 Production Database Foundation Migration
-- Migration: 20261124000001_phase1_production_foundation.sql
-- Description: Reliable database foundation for campaign email templates,
--              Resend email delivery tracking, persistent callbacks,
--              distributed API rate limiting, and atomic job concurrency.
--
-- Safety Guarantee:
-- - Purely ADDITIVE: Never drops or alters existing active tables.
-- - Reuses existing function: Preserves private.has_permission(target_org, permission_key).
-- - Foreign keys reference verified remote tables: organizations(id), call_sessions(id), leads(id), campaigns(id).
-- - Fully repeatable and idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS).
-- - Rollback instructions included at the end of this file.
 -- ============================================================================

-- ============================================================================
-- 0. PRIVATE SCHEMA & PERMISSION HELPER
-- ============================================================================

-- Ensure the private schema exists for internal security and helper functions
CREATE SCHEMA IF NOT EXISTS private;

-- Restrict schema access: authenticated and service_role only; block anon and public
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;

-- Preserve exact existing function signature: (target_org uuid, permission_key text)
-- Evaluates membership role in public.organization_memberships against public.role_permissions
CREATE OR REPLACE FUNCTION private.has_permission(
  target_org uuid,
  permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
BEGIN
  -- Unauthenticated requests immediately fail-closed
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Organization ID and permission key must be non-null
  IF target_org IS NULL OR permission_key IS NULL THEN
    RETURN false;
  END IF;

  -- Validate active membership in the organization with an assigned role granting the permission
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.organization_id = target_org
      AND m.user_id = auth.uid()
      AND rp.permission_key = has_permission.permission_key
  );
END;
$$;

-- Restrict execution: authenticated and service_role only; strictly revoke from anon and PUBLIC
REVOKE ALL ON FUNCTION private.has_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_permission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text) TO authenticated, service_role;


-- ============================================================================
-- 1. DISTRIBUTED API RATE LIMITING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_reset_at 
  ON public.api_rate_limits (reset_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_manage_api_rate_limits" ON public.api_rate_limits;
CREATE POLICY "service_role_manage_api_rate_limits" 
  ON public.api_rate_limits 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Atomic stored procedure for cross-instance serverless sliding window rate checks
CREATE OR REPLACE FUNCTION public.check_shared_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INTEGER,
  remaining INTEGER,
  reset_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_interval INTERVAL := (p_window_ms || ' milliseconds')::interval;
  v_record public.api_rate_limits%ROWTYPE;
  v_allowed BOOLEAN;
  v_remaining INTEGER;
  v_reset_ms INTEGER;
BEGIN
  INSERT INTO public.api_rate_limits (key, count, reset_at, created_at, updated_at)
  VALUES (p_key, 1, v_now + v_window_interval, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN public.api_rate_limits.reset_at <= v_now THEN 1
      ELSE public.api_rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN public.api_rate_limits.reset_at <= v_now THEN v_now + v_window_interval
      ELSE public.api_rate_limits.reset_at
    END,
    updated_at = v_now
  RETURNING * INTO v_record;

  IF v_record.count <= p_limit THEN
    v_allowed := true;
    v_remaining := GREATEST(0, p_limit - v_record.count);
  ELSE
    v_allowed := false;
    v_remaining := 0;
  END IF;

  v_reset_ms := GREATEST(0, (EXTRACT(EPOCH FROM (v_record.reset_at - v_now)) * 1000)::integer);

  RETURN QUERY SELECT v_allowed, v_record.count, v_remaining, v_reset_ms;
END;
$$;

REVOKE ALL ON FUNCTION public.check_shared_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_shared_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated, service_role;


-- ============================================================================
-- 2. WORKSPACE EMAIL AUTOMATION SETTINGS
-- ============================================================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.email_automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_email_automation_settings" ON public.email_automation_settings;
CREATE POLICY "service_role_email_automation_settings" 
  ON public.email_automation_settings 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_email_automation_settings_select" ON public.email_automation_settings;
CREATE POLICY "authenticated_email_automation_settings_select" 
  ON public.email_automation_settings 
  FOR SELECT 
  TO authenticated 
  USING (private.has_permission(organization_id, 'org.manage') OR private.has_permission(organization_id, 'campaigns.read'));

DROP POLICY IF EXISTS "authenticated_email_automation_settings_modify" ON public.email_automation_settings;
CREATE POLICY "authenticated_email_automation_settings_modify" 
  ON public.email_automation_settings 
  FOR ALL 
  TO authenticated 
  USING (private.has_permission(organization_id, 'org.manage'))
  WITH CHECK (private.has_permission(organization_id, 'org.manage'));


-- ============================================================================
-- 3. CAMPAIGN EMAIL TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, campaign_id, name)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org_camp 
  ON public.email_templates (organization_id, campaign_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_email_templates" ON public.email_templates;
CREATE POLICY "service_role_email_templates" 
  ON public.email_templates 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_email_templates_select" ON public.email_templates;
CREATE POLICY "authenticated_email_templates_select" 
  ON public.email_templates 
  FOR SELECT 
  TO authenticated 
  USING (private.has_permission(organization_id, 'campaigns.read'));

DROP POLICY IF EXISTS "authenticated_email_templates_modify" ON public.email_templates;
CREATE POLICY "authenticated_email_templates_modify" 
  ON public.email_templates 
  FOR ALL 
  TO authenticated 
  USING (private.has_permission(organization_id, 'campaigns.write'))
  WITH CHECK (private.has_permission(organization_id, 'campaigns.write'));


-- ============================================================================
-- 4. EMAIL SUPPRESSION LIST (Unsubscribes, Bounces, Stop-All)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual', 'stop_all')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_lookup 
  ON public.email_suppressions (organization_id, email);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_email_suppressions" ON public.email_suppressions;
CREATE POLICY "service_role_email_suppressions" 
  ON public.email_suppressions 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_email_suppressions_select" ON public.email_suppressions;
CREATE POLICY "authenticated_email_suppressions_select" 
  ON public.email_suppressions 
  FOR SELECT 
  TO authenticated 
  USING (private.has_permission(organization_id, 'campaigns.read'));

DROP POLICY IF EXISTS "authenticated_email_suppressions_modify" ON public.email_suppressions;
CREATE POLICY "authenticated_email_suppressions_modify" 
  ON public.email_suppressions 
  FOR ALL 
  TO authenticated 
  USING (private.has_permission(organization_id, 'campaigns.write'))
  WITH CHECK (private.has_permission(organization_id, 'campaigns.write'));


-- ============================================================================
-- 5. EMAIL JOBS QUEUE (Idempotent Lease & Dispatch Tracker)
-- ============================================================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_poll 
  ON public.email_jobs (organization_id, status, next_attempt_at) 
  WHERE status IN ('queued', 'retry');

CREATE INDEX IF NOT EXISTS idx_email_jobs_lead 
  ON public.email_jobs (lead_id);

ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_email_jobs" ON public.email_jobs;
CREATE POLICY "service_role_email_jobs" 
  ON public.email_jobs 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_email_jobs_select" ON public.email_jobs;
CREATE POLICY "authenticated_email_jobs_select" 
  ON public.email_jobs 
  FOR SELECT 
  TO authenticated 
  USING (private.has_permission(organization_id, 'campaigns.read'));


-- ============================================================================
-- 6. EMAIL MESSAGES (Dispatched Delivery Ledger & CRM Timeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.email_jobs(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  call_session_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT DEFAULT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'qualification_follow_up' CHECK (category IN ('qualification_follow_up', 'requested_information', 'general_follow_up')),
  resend_id TEXT DEFAULT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'delivered', 'bounced', 'not_delivered', 'accepted')),
  last_error TEXT DEFAULT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NULL,
  bounced_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_email_messages_resend 
  ON public.email_messages (resend_id) 
  WHERE resend_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_status 
  ON public.email_messages (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_email_messages_lead 
  ON public.email_messages (organization_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_email_messages_camp 
  ON public.email_messages (organization_id, campaign_id);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_email_messages" ON public.email_messages;
CREATE POLICY "service_role_email_messages" 
  ON public.email_messages 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_email_messages_select" ON public.email_messages;
CREATE POLICY "authenticated_email_messages_select" 
  ON public.email_messages 
  FOR SELECT 
  TO authenticated 
  USING (private.has_permission(organization_id, 'campaigns.read'));


-- ============================================================================
-- 7. EMAIL WEBHOOK EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.email_messages(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.email_jobs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  provider_event_id TEXT DEFAULT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_email_events_msg 
  ON public.email_events (message_id);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_email_events" ON public.email_events;
CREATE POLICY "service_role_email_events" 
  ON public.email_events 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_email_events_select" ON public.email_events;
CREATE POLICY "authenticated_email_events_select" 
  ON public.email_events 
  FOR SELECT 
  TO authenticated 
  USING (private.has_permission(organization_id, 'audit.read'));


-- ============================================================================
-- 8. PERSISTENT CALLBACKS LEDGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  call_session_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'missed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  notes TEXT NOT NULL DEFAULT '',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, call_session_id)
);

CREATE INDEX IF NOT EXISTS idx_callbacks_queue 
  ON public.callbacks (organization_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_callbacks_lead 
  ON public.callbacks (lead_id);

ALTER TABLE public.callbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_callbacks" ON public.callbacks;
CREATE POLICY "service_role_callbacks" 
  ON public.callbacks 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_callbacks_select" ON public.callbacks;
CREATE POLICY "authenticated_callbacks_select" 
  ON public.callbacks 
  FOR SELECT 
  TO authenticated 
  USING (
    private.has_permission(organization_id, 'leads.read_all') 
    OR (
      assigned_to = auth.uid() 
      AND private.has_permission(organization_id, 'leads.read_assigned')
    )
  );

DROP POLICY IF EXISTS "authenticated_callbacks_modify" ON public.callbacks;
CREATE POLICY "authenticated_callbacks_modify" 
  ON public.callbacks 
  FOR ALL 
  TO authenticated 
  USING (
    private.has_permission(organization_id, 'leads.write') 
    OR (
      assigned_to = auth.uid() 
      AND private.has_permission(organization_id, 'leads.update_assigned')
    )
  )
  WITH CHECK (
    private.has_permission(organization_id, 'leads.write') 
    OR (
      assigned_to = auth.uid() 
      AND private.has_permission(organization_id, 'leads.update_assigned')
    )
  );


-- ============================================================================
-- 9. ATOMIC STORED PROCEDURES (Concurrency, Idempotency & Redaction)
-- ============================================================================

-- Procedure: claim_email_job (Atomic lease acquisition preventing double sends)
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

REVOKE ALL ON FUNCTION public.claim_email_job(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_email_job(UUID, INTEGER) TO authenticated, service_role;

-- Procedure: redact_expired_email_bodies (Privacy data retention compliance)
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

REVOKE ALL ON FUNCTION public.redact_expired_email_bodies(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redact_expired_email_bodies(INTEGER) TO authenticated, service_role;

-- Procedure: claim_next_campaign_lead (Atomic lead claiming with SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_next_campaign_lead(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_enrollment_id UUID,
  lead_id UUID,
  lead_phone TEXT,
  lead_name TEXT,
  lead_company TEXT,
  lead_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_lead_id UUID;
BEGIN
  -- Atomically lock and claim the next unenrolled lead that has no active/completed calls in this campaign
  -- and strictly respects DNC and soft-deletion
  SELECT ce.id, ce.lead_id INTO v_enrollment_id, v_lead_id
  FROM public.campaign_enrollments ce
  JOIN public.leads l ON l.id = ce.lead_id
  WHERE ce.campaign_id = p_campaign_id
    AND l.do_not_call IS NOT TRUE
    AND l.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM public.call_sessions cs 
      WHERE cs.campaign_id = p_campaign_id 
        AND cs.lead_id = ce.lead_id
    )
  ORDER BY ce.created_at ASC
  FOR UPDATE OF ce SKIP LOCKED
  LIMIT 1;

  IF v_enrollment_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_enrollment_id,
    l.id,
    l.phone,
    l.name,
    l.company,
    l.title
  FROM public.leads l
  WHERE l.id = v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_campaign_lead(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_next_campaign_lead(UUID) TO authenticated, service_role;


-- ============================================================================
-- 10. RECOVERY & ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To safely reverse this migration without affecting any core dialer tables,
-- execute the following statements in reverse dependency order:
--
-- DROP FUNCTION IF EXISTS public.claim_next_campaign_lead(UUID);
-- DROP FUNCTION IF EXISTS public.redact_expired_email_bodies(INTEGER);
-- DROP FUNCTION IF EXISTS public.claim_email_job(UUID, INTEGER);
-- DROP TABLE IF EXISTS public.callbacks;
-- DROP TABLE IF EXISTS public.email_events;
-- DROP TABLE IF EXISTS public.email_messages;
-- DROP TABLE IF EXISTS public.email_jobs;
-- DROP TABLE IF EXISTS public.email_suppressions;
-- DROP TABLE IF EXISTS public.email_templates;
-- DROP TABLE IF EXISTS public.email_automation_settings;
-- DROP FUNCTION IF EXISTS public.check_shared_rate_limit(TEXT, INTEGER, INTEGER);
-- DROP TABLE IF EXISTS public.api_rate_limits;
-- Note: Do NOT drop private.has_permission(uuid, text) as it is owned by postgres
--       and may be referenced by core system permissions.
-- ============================================================================
