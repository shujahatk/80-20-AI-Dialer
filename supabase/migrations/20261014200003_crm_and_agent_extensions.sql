-- Migration: 20261014200003_crm_and_agent_extensions.sql
-- Description: Additive CRM notes/tags, AI Agent studio versions/knowledge/simulations, and telemetry events.
-- References verified remote tables: organizations(id), leads(id), profiles(id), ai_agents(id), call_sessions(id), campaigns(id).
-- Timestamped after remote migration: 20261014192444_phase4_call_audit

-- 1. Lead Notes
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Lead Tags
CREATE TABLE IF NOT EXISTS public.lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#10B981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

-- 3. Lead Tag Assignments
CREATE TABLE IF NOT EXISTS public.lead_tag_assignments (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, tag_id)
);

-- 4. AI Agent Versions
CREATE TABLE IF NOT EXISTS public.ai_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL DEFAULT '',
  greeting TEXT NOT NULL DEFAULT '',
  voice_provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice_id TEXT NOT NULL DEFAULT '',
  speaking_speed NUMERIC NOT NULL DEFAULT 1.0,
  stability NUMERIC NOT NULL DEFAULT 0.5,
  similarity NUMERIC NOT NULL DEFAULT 0.75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. AI Agent Knowledge
CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id UUID REFERENCES public.ai_agent_versions(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('Company', 'Services', 'Materials', 'Industries', 'FAQ', 'Qualification', 'Objections', 'Compliance', 'Handoff')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'faq', 'document', 'url')),
  source_url TEXT,
  retell_knowledge_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. AI Agent Simulations
CREATE TABLE IF NOT EXISTS public.ai_agent_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id UUID REFERENCES public.ai_agent_versions(id) ON DELETE SET NULL,
  scenario_key TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed', 'flagged')),
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Call Events Telemetry
CREATE TABLE IF NOT EXISTS public.call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Campaign Events Telemetry
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON public.lead_notes (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tag_assignments_tag ON public.lead_tag_assignments (tag_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_versions_agent ON public.ai_agent_versions (agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_agent ON public.ai_agent_knowledge (agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_simulations_agent ON public.ai_agent_simulations (agent_id);
CREATE INDEX IF NOT EXISTS idx_call_events_call ON public.call_events (call_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON public.campaign_events (campaign_id);

-- Enable RLS
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- Service Role Policies
CREATE POLICY "service_role_lead_notes" ON public.lead_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_lead_tags" ON public.lead_tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_lead_tag_assignments" ON public.lead_tag_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_ai_agent_versions" ON public.ai_agent_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_ai_agent_knowledge" ON public.ai_agent_knowledge FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_ai_agent_simulations" ON public.ai_agent_simulations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_call_events" ON public.call_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_campaign_events" ON public.campaign_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Tenant Policies
CREATE POLICY "lead_notes_select" ON public.lead_notes FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'leads.read_all') OR private.has_permission(organization_id, 'leads.read_assigned'));

CREATE POLICY "lead_notes_insert" ON public.lead_notes FOR INSERT TO authenticated
  WITH CHECK (private.has_permission(organization_id, 'leads.write') OR private.has_permission(organization_id, 'leads.update_assigned'));

CREATE POLICY "lead_tags_select" ON public.lead_tags FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'leads.read_all') OR private.has_permission(organization_id, 'leads.read_assigned'));

CREATE POLICY "lead_tag_assignments_select" ON public.lead_tag_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_tag_assignments.lead_id AND (private.has_permission(l.organization_id, 'leads.read_all') OR (l.assigned_to = auth.uid() AND private.has_permission(l.organization_id, 'leads.read_assigned')))));

CREATE POLICY "ai_agent_versions_select" ON public.ai_agent_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_agents a WHERE a.id = ai_agent_versions.agent_id AND (private.has_permission(a.organization_id, 'agents.read') OR private.has_permission(a.organization_id, 'agents.write'))));

CREATE POLICY "ai_agent_knowledge_select" ON public.ai_agent_knowledge FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'agents.read') OR private.has_permission(organization_id, 'agents.write'));

CREATE POLICY "ai_agent_simulations_select" ON public.ai_agent_simulations FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'agents.read') OR private.has_permission(organization_id, 'agents.write'));

CREATE POLICY "call_events_select" ON public.call_events FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'calls.read'));

CREATE POLICY "campaign_events_select" ON public.campaign_events FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'campaigns.read'));
