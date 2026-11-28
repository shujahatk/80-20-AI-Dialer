-- =============================================================================
-- RM AI DIALER — SAFE LEAD ARCHIVE & RLS POLICY REPAIR MIGRATION
-- Migration: 20261128000003_fix_lead_archive_and_rls.sql
-- =============================================================================

-- 1. Repair leads_select policy so updating deleted_at does not violate RLS
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
USING (
  private.has_permission(organization_id, 'leads.read_all'::text) OR 
  ((assigned_to = (SELECT auth.uid() AS uid)) AND private.has_permission(organization_id, 'leads.read_assigned'::text))
);

-- 2. Repair guard_lead_update trigger to allow service_role and background webhooks to update leads safely
CREATE OR REPLACE FUNCTION public.guard_lead_update()
RETURNS trigger AS $$
BEGIN
  IF new.organization_id IS DISTINCT FROM old.organization_id THEN
    RAISE EXCEPTION 'Organization cannot change';
  END IF;

  -- Service role / administrative client bypass
  IF current_user = 'service_role' OR auth.role() = 'service_role' OR (SELECT auth.uid()) IS NULL THEN
    RETURN new;
  END IF;

  -- Users with leads.write permission (admin, manager) have full lead modification rights
  IF private.has_permission(old.organization_id, 'leads.write') THEN
    RETURN new;
  END IF;

  -- Users with update_assigned permission can update their own leads
  IF old.assigned_to IS DISTINCT FROM (SELECT auth.uid())
     OR NOT private.has_permission(old.organization_id, 'leads.update_assigned') THEN
    RAISE EXCEPTION 'Not allowed to update this lead';
  END IF;

  IF new.assigned_to IS DISTINCT FROM old.assigned_to
     OR new.created_by IS DISTINCT FROM old.created_by
     OR new.deleted_at IS DISTINCT FROM old.deleted_at
     OR new.email IS DISTINCT FROM old.email
     OR new.deal_value IS DISTINCT FROM old.deal_value
     OR new.do_not_call IS DISTINCT FROM old.do_not_call
     OR new.consent_at IS DISTINCT FROM old.consent_at THEN
    RAISE EXCEPTION 'Assigned agents cannot change ownership, consent, or archive a lead';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 3. Atomic lead archive RPC function
CREATE OR REPLACE FUNCTION public.archive_lead_records(
  p_lead_ids UUID[],
  p_org_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_active_call RECORD;
BEGIN
  -- 1. Check if any selected lead has a live call in progress
  SELECT id, lead_id INTO v_active_call
  FROM public.call_sessions
  WHERE organization_id = p_org_id
    AND lead_id = ANY(p_lead_ids)
    AND status IN ('queued', 'registered', 'ringing', 'in_progress', 'initiated')
    AND ended_at IS NULL
  LIMIT 1;

  IF v_active_call.id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete lead while a live call is in progress (Call ID: %)', v_active_call.id;
  END IF;

  -- 2. Mark any queued or calling campaign enrollments as abandoned
  UPDATE public.campaign_enrollments
  SET
    state = 'abandoned',
    next_attempt_at = NULL,
    claimed_by = NULL,
    claimed_at = NULL,
    updated_at = NOW()
  WHERE organization_id = p_org_id
    AND lead_id = ANY(p_lead_ids)
    AND state IN ('queued', 'calling');

  -- 3. Soft-delete the leads
  UPDATE public.leads
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE organization_id = p_org_id
    AND id = ANY(p_lead_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_lead_records(UUID[], UUID) TO authenticated, service_role;
