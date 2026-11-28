-- ============================================================================
-- RM AI DIALER: Call State Synchronization & Duplicate Concurrency Lock
-- Migration: 20261128000001_fix_stuck_calls_and_concurrency_lock.sql
-- Description:
-- 1. Self-heals any historical call sessions stuck in queued/registered state with ended_at populated.
-- 2. Enforces atomic single-active-call constraint per lead at the database level using a partial unique index.
-- 3. Provides performance indexes for active call lookup and status reconciliation.
-- ============================================================================

-- 1. Self-heal any historical stuck calls in call_sessions table
UPDATE public.call_sessions
SET status = CASE
  WHEN disconnection_reason ILIKE '%busy%' THEN 'busy'
  WHEN disconnection_reason ILIKE '%no_answer%' OR disconnection_reason ILIKE '%dial_no_answer%' THEN 'no_answer'
  WHEN disconnection_reason ILIKE '%voicemail%' THEN 'no_answer'
  WHEN disconnection_reason ILIKE '%fail%' OR disconnection_reason ILIKE '%error%' THEN 'failed'
  ELSE 'completed'
END
WHERE status IN ('queued', 'registered', 'ringing', 'in_progress')
  AND (ended_at IS NOT NULL OR disconnection_reason IS NOT NULL);

-- 2. Atomic lead-level concurrency protection
-- Guarantees that no lead can have more than one active (queued, ringing, in_progress) call session simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_sessions_active_lead
ON public.call_sessions (lead_id)
WHERE status IN ('queued', 'ringing', 'in_progress')
  AND ended_at IS NULL
  AND lead_id IS NOT NULL;

-- 3. Performance index for active call lookups
CREATE INDEX IF NOT EXISTS idx_call_sessions_lead_active
ON public.call_sessions (lead_id, organization_id, status)
WHERE ended_at IS NULL;

-- 4. Stale session reconciliation helper function
CREATE OR REPLACE FUNCTION public.reconcile_stale_call_sessions(
  p_max_age_interval INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS TABLE (
  reconciled_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.call_sessions
  SET status = CASE
    WHEN disconnection_reason ILIKE '%busy%' THEN 'busy'
    WHEN disconnection_reason ILIKE '%no_answer%' OR disconnection_reason ILIKE '%dial_no_answer%' THEN 'no_answer'
    WHEN disconnection_reason ILIKE '%voicemail%' THEN 'no_answer'
    WHEN disconnection_reason ILIKE '%fail%' OR disconnection_reason ILIKE '%error%' THEN 'failed'
    ELSE 'completed'
  END
  WHERE status IN ('queued', 'registered', 'ringing', 'in_progress')
    AND (ended_at IS NOT NULL OR disconnection_reason IS NOT NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  reconciled_count := v_updated;
  RETURN NEXT;
END;
$$;
