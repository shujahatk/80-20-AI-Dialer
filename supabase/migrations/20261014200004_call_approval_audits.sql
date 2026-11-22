-- Migration: 20261014200004_call_approval_audits.sql
-- Description: Additive immutable human call approval audit evidence ledger.
-- Preserves existing call_sessions schema and creates dedicated audit trail.
-- Timestamped after remote migration: 20261014192444_phase4_call_audit

CREATE TABLE IF NOT EXISTS public.call_approval_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  approved_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected', 'revoked')),
  method TEXT NOT NULL DEFAULT 'manual_operator_ai_dispatch',
  audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Index for session audit lookups
CREATE INDEX IF NOT EXISTS idx_call_approval_audits_session ON public.call_approval_audits (call_session_id);
CREATE INDEX IF NOT EXISTS idx_call_approval_audits_org ON public.call_approval_audits (organization_id, approved_at);

-- Enable Row Level Security
ALTER TABLE public.call_approval_audits ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_call_approval_audits" ON public.call_approval_audits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users with call authorization can read approval audit trail
CREATE POLICY "call_approval_audits_select" ON public.call_approval_audits
  FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'calls.read') OR private.has_permission(organization_id, 'audit.read'));

-- Only users with calls.place permission can insert approval records for themselves
CREATE POLICY "call_approval_audits_insert" ON public.call_approval_audits
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_permission(organization_id, 'calls.place')
    AND approved_by = auth.uid()
  );

-- No UPDATE or DELETE policy: Immutable audit ledger
