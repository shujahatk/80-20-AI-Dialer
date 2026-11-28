-- =============================================================================
-- RM AI DIALER — FINAL PRODUCTION CAMPAIGN AUTOMATION & CRM INTELLIGENCE MIGRATION
-- 1. Safely extends campaign_status enum with 'scheduled', 'running', 'completed', 'cancelled'
-- 2. Adds durable queue, 3-attempt retry, and qualification tracking columns to campaign_enrollments
-- 3. Seeds the default published Retell AI voice agent into public.ai_agents
-- =============================================================================

-- 1. Extend campaign_status enum safely
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'running';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. Add durable queue & retry tracking columns to public.campaign_enrollments
ALTER TABLE public.campaign_enrollments
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_call_id uuid REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS qualification_outcome text,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_queue
  ON public.campaign_enrollments (campaign_id, state, next_attempt_at);

-- 3. Ensure default published Retell AI agent exists in public.ai_agents
INSERT INTO public.ai_agents (
  id,
  organization_id,
  name,
  description,
  prompt,
  voice,
  retell_agent_id,
  status,
  created_at,
  updated_at
)
SELECT
  'a1111111-2222-4333-8444-555555555555'::uuid,
  '2f7cec0b-6e1b-419c-80eb-2254789daac2'::uuid,
  'Rachel — RM Commercial Trading & Materials Agent',
  'Primary autonomous outbound B2B trading & industrial materials qualification agent powered by Retell AI and Twilio.',
  'Conduct a concise, executive commercial qualification call for RM Global Materials. Confirm decision-maker responsibility, material requirements, estimated tonnage/volume, grade specifications, delivery location, and commercial timeline.',
  'retell-rachel-neural',
  'agent_25a6c8f0015fbdc154a572e2a8',
  'ready',
  now(),
  now()
WHERE EXISTS (
  SELECT 1 FROM public.organizations WHERE id = '2f7cec0b-6e1b-419c-80eb-2254789daac2'::uuid
)
AND NOT EXISTS (
  SELECT 1 FROM public.ai_agents
  WHERE organization_id = '2f7cec0b-6e1b-419c-80eb-2254789daac2'::uuid
    AND retell_agent_id = 'agent_25a6c8f0015fbdc154a572e2a8'
);
