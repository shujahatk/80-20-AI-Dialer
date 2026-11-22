-- 80/20 AI DIALER: Core Dialer Database Schema Migration
-- Migration: 20261010000001_core_dialer_schema.sql
-- Covers core entities: organizations, profiles, leads, campaigns, calls, agents, transcripts, notes, tags

-- 1. Custom Enum Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'invited', 'disabled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_status_db AS ENUM ('new', 'queued', 'in_progress', 'contacted', 'qualified', 'converted', 'unqualified', 'dnc');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_priority_db AS ENUM ('urgent', 'high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status_db AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_status_db AS ENUM ('queued', 'ringing', 'in_progress', 'completed', 'busy', 'no_answer', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_direction_db AS ENUM ('outbound', 'inbound');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE callback_status_db AS ENUM ('pending', 'completed', 'missed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status_db AS ENUM ('scheduled', 'held', 'rescheduled', 'no_show', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_status_db AS ENUM ('connected', 'disconnected', 'degraded', 'testing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE webhook_status_db AS ENUM ('received', 'processed', 'failed', 'ignored');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Profiles (Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'operator',
  status user_status NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- 4. Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- 5. Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  email TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  region TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  source TEXT NOT NULL DEFAULT 'manual',
  status lead_status_db NOT NULL DEFAULT 'new',
  priority lead_priority_db NOT NULL DEFAULT 'medium',
  is_dnc BOOLEAN NOT NULL DEFAULT false,
  dnc_reason TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  next_contact_at TIMESTAMPTZ,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  stop_all_contact BOOLEAN NOT NULL DEFAULT false,
  email_unsubscribed_at TIMESTAMPTZ,
  email_opt_in BOOLEAN NOT NULL DEFAULT false,
  email_lawful_basis TEXT,
  email_lawful_basis_evidence TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Lead Notes
CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Lead Tags
CREATE TABLE IF NOT EXISTS lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  UNIQUE (organization_id, name)
);

-- 8. Lead Tag Assignments
CREATE TABLE IF NOT EXISTS lead_tag_assignments (
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

-- 9. AI Agents
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT '',
  active_version_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  retell_agent_id TEXT,
  retell_llm_id TEXT,
  retell_knowledge_base_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'draft' CHECK (sync_status IN ('draft', 'syncing', 'synced', 'failed', 'stale')),
  last_synced_at TIMESTAMPTZ,
  stage_state TEXT NOT NULL DEFAULT 'draft' CHECK (stage_state IN ('draft', 'training', 'testing', 'ready', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. AI Agent Versions
CREATE TABLE IF NOT EXISTS ai_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL DEFAULT '',
  greeting TEXT NOT NULL DEFAULT '',
  voice_provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice_id TEXT NOT NULL DEFAULT '',
  speaking_speed NUMERIC NOT NULL DEFAULT 1.0,
  stability NUMERIC NOT NULL DEFAULT 0.5,
  similarity NUMERIC NOT NULL DEFAULT 0.75,
  qualification_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  objection_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  closing_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  handoff_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraint for active_version_id
DO $$ BEGIN
  ALTER TABLE ai_agents
    ADD CONSTRAINT fk_ai_agents_active_version
    FOREIGN KEY (active_version_id) REFERENCES ai_agent_versions(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 11. Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status campaign_status_db NOT NULL DEFAULT 'draft',
  ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  calling_window_start TEXT NOT NULL DEFAULT '09:00',
  calling_window_end TEXT NOT NULL DEFAULT '17:00',
  max_attempts_per_lead INTEGER NOT NULL DEFAULT 3,
  retry_delay_minutes INTEGER NOT NULL DEFAULT 60,
  concurrency_limit INTEGER NOT NULL DEFAULT 1,
  daily_attempt_limit INTEGER NOT NULL DEFAULT 100,
  calling_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  email_followup_enabled BOOLEAN NOT NULL DEFAULT false,
  email_lawful_basis TEXT,
  email_lawful_basis_note TEXT,
  email_instructions TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Campaign Leads
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'pending',
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  claim_expires_at TIMESTAMPTZ,
  outcome TEXT,
  last_call_id UUID,
  final_disposition_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id)
);

-- 13. Calls
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'retell',
  provider_call_id TEXT,
  retell_call_id TEXT,
  provider_agent_id TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  disconnection_reason TEXT,
  call_cost NUMERIC NOT NULL DEFAULT 0,
  direction call_direction_db NOT NULL DEFAULT 'outbound',
  status call_status_db NOT NULL DEFAULT 'queued',
  outcome TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ringing_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  connected_seconds INTEGER NOT NULL DEFAULT 0,
  recording_status TEXT NOT NULL DEFAULT 'none',
  transcript_status TEXT NOT NULL DEFAULT 'none',
  failure_code TEXT,
  failure_reason TEXT,
  sentiment_score NUMERIC,
  intent_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. AI Agent Simulations
CREATE TABLE IF NOT EXISTS ai_agent_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  agent_version_id UUID REFERENCES ai_agent_versions(id) ON DELETE SET NULL,
  scenario_key TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed', 'flagged')),
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  executed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. AI Agent Knowledge
CREATE TABLE IF NOT EXISTS ai_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  agent_version_id UUID REFERENCES ai_agent_versions(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('Company', 'Services', 'Materials', 'Industries', 'FAQ', 'Qualification', 'Objections', 'Compliance', 'Handoff')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'faq', 'document', 'url')),
  source_url TEXT,
  retell_knowledge_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'draft' CHECK (sync_status IN ('draft', 'synced', 'failed', 'stale')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Call Events
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Call Transcripts
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL DEFAULT 0,
  ended_at_ms INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 18. Call Recordings
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'retell',
  provider_recording_id TEXT,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'audio/mp3',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. Dispositions
CREATE TABLE IF NOT EXISTS dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  triggers_dnc BOOLEAN NOT NULL DEFAULT false,
  triggers_callback BOOLEAN NOT NULL DEFAULT false
);

-- 20. Callbacks
CREATE TABLE IF NOT EXISTS callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  reason TEXT NOT NULL DEFAULT '',
  notes TEXT,
  status callback_status_db NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 21. Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  meeting_type TEXT NOT NULL DEFAULT 'demo',
  notes TEXT,
  status appointment_status_db NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 22. Provider Connections
CREATE TABLE IF NOT EXISTS provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status provider_status_db NOT NULL DEFAULT 'disconnected',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

-- 23. Webhook Events
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_valid BOOLEAN NOT NULL DEFAULT true,
  processing_status webhook_status_db NOT NULL DEFAULT 'received',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (provider, external_event_id)
);

-- 24. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 25. Import Jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  strategy TEXT NOT NULL DEFAULT 'skip' CHECK (strategy IN ('skip', 'update_missing', 'overwrite')),
  target_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  column_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 26. Campaign Events
CREATE TABLE IF NOT EXISTS campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes for Core Performance
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_phone_e164 ON leads (organization_id, phone_e164);
CREATE INDEX IF NOT EXISTS idx_leads_is_dnc ON leads (organization_id, is_dnc);
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON calls (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_retell_id ON calls (retell_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls (lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_dispatch ON campaign_leads (campaign_id, state, attempt_count);
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events (call_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts (call_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON audit_logs (organization_id, created_at DESC);

-- RPC Function: claim_next_campaign_lead
CREATE OR REPLACE FUNCTION claim_next_campaign_lead(
  p_campaign_id UUID,
  p_worker_id TEXT,
  p_claim_duration_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  campaign_lead_id UUID,
  campaign_id UUID,
  lead_id UUID,
  attempt_count INTEGER,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  phone_e164 TEXT,
  timezone TEXT,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_record RECORD;
BEGIN
  -- Lock the next eligible campaign lead using SKIP LOCKED
  SELECT cl.id, cl.campaign_id, cl.lead_id, cl.attempt_count
  INTO v_lead_record
  FROM campaign_leads cl
  JOIN leads l ON l.id = cl.lead_id
  WHERE cl.campaign_id = p_campaign_id
    AND cl.state IN ('pending', 'queued', 'retry')
    AND (cl.claim_expires_at IS NULL OR cl.claim_expires_at < now())
    AND l.is_dnc = false
    AND l.stop_all_contact = false
  ORDER BY cl.attempt_count ASC, cl.created_at ASC
  LIMIT 1
  FOR UPDATE OF cl SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Apply claim lease
  UPDATE campaign_leads cl
  SET
    state = 'calling',
    claimed_at = now(),
    claimed_by = p_worker_id,
    claim_expires_at = now() + (COALESCE(p_claim_duration_seconds, 300) || ' seconds')::interval,
    updated_at = now()
  WHERE cl.id = v_lead_record.id;

  RETURN QUERY
  SELECT
    cl.id AS campaign_lead_id,
    cl.campaign_id,
    cl.lead_id,
    cl.attempt_count,
    l.first_name,
    l.last_name,
    l.full_name,
    l.company_name,
    l.phone,
    l.phone_e164,
    l.timezone,
    cl.claimed_at,
    cl.claim_expires_at
  FROM campaign_leads cl
  JOIN leads l ON l.id = cl.lead_id
  WHERE cl.id = v_lead_record.id;
END;
$$;

-- RLS Helper & Multi-Tenant Isolation
CREATE OR REPLACE FUNCTION get_current_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Enable Row Level Security on all core tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (essential for server-side repositories & dispatchers)
CREATE POLICY "Service role full access on organizations" ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on profiles" ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on organization_members" ON organization_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on lead_notes" ON lead_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on lead_tags" ON lead_tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on lead_tag_assignments" ON lead_tag_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on ai_agents" ON ai_agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on ai_agent_versions" ON ai_agent_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on campaigns" ON campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on campaign_leads" ON campaign_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on calls" ON calls FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on ai_agent_simulations" ON ai_agent_simulations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on ai_agent_knowledge" ON ai_agent_knowledge FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on call_events" ON call_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on call_transcripts" ON call_transcripts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on call_recordings" ON call_recordings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on dispositions" ON dispositions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on callbacks" ON callbacks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on appointments" ON appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on provider_connections" ON provider_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on webhook_events" ON webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on audit_logs" ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on import_jobs" ON import_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on campaign_events" ON campaign_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated user tenant isolation policies
CREATE POLICY "Tenant isolation for organizations" ON organizations FOR SELECT TO authenticated USING (id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for profiles" ON profiles FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for organization_members" ON organization_members FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for leads" ON leads FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for lead_notes" ON lead_notes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_notes.lead_id AND leads.organization_id = get_current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_notes.lead_id AND leads.organization_id = get_current_user_org_id()));
CREATE POLICY "Tenant isolation for lead_tags" ON lead_tags FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for lead_tag_assignments" ON lead_tag_assignments FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_tag_assignments.lead_id AND leads.organization_id = get_current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_tag_assignments.lead_id AND leads.organization_id = get_current_user_org_id()));
CREATE POLICY "Tenant isolation for ai_agents" ON ai_agents FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for ai_agent_versions" ON ai_agent_versions FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM ai_agents WHERE ai_agents.id = ai_agent_versions.agent_id AND ai_agents.organization_id = get_current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM ai_agents WHERE ai_agents.id = ai_agent_versions.agent_id AND ai_agents.organization_id = get_current_user_org_id()));
CREATE POLICY "Tenant isolation for campaigns" ON campaigns FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for campaign_leads" ON campaign_leads FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.organization_id = get_current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.organization_id = get_current_user_org_id()));
CREATE POLICY "Tenant isolation for calls" ON calls FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for ai_agent_simulations" ON ai_agent_simulations FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for ai_agent_knowledge" ON ai_agent_knowledge FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for call_events" ON call_events FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for call_transcripts" ON call_transcripts FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_transcripts.call_id AND calls.organization_id = get_current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_transcripts.call_id AND calls.organization_id = get_current_user_org_id()));
CREATE POLICY "Tenant isolation for call_recordings" ON call_recordings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_recordings.call_id AND calls.organization_id = get_current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_recordings.call_id AND calls.organization_id = get_current_user_org_id()));
CREATE POLICY "Tenant isolation for dispositions" ON dispositions FOR ALL TO authenticated USING (organization_id IS NULL OR organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for callbacks" ON callbacks FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for appointments" ON appointments FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for provider_connections" ON provider_connections FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for webhook_events" ON webhook_events FOR ALL TO authenticated USING (organization_id IS NULL OR organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for audit_logs" ON audit_logs FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for import_jobs" ON import_jobs FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());
CREATE POLICY "Tenant isolation for campaign_events" ON campaign_events FOR ALL TO authenticated USING (organization_id = get_current_user_org_id()) WITH CHECK (organization_id = get_current_user_org_id());

