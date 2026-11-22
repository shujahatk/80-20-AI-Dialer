-- Migration: 20261014200001_shared_rate_limits.sql
-- Description: Persistent shared rate limiting table and atomic function for serverless environments.
-- Timestamped after remote migration: 20261014192444_phase4_call_audit

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service_role full administrative access
DROP POLICY IF EXISTS "Service role full access on api_rate_limits" ON public.api_rate_limits;
CREATE POLICY "Service role full access on api_rate_limits"
  ON public.api_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for expiring stale rate limit rows
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_reset_at ON public.api_rate_limits (reset_at);

-- Atomic function to check and increment rate limit in a single atomic transaction
CREATE OR REPLACE FUNCTION public.check_shared_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
RETURNS TABLE (
  allowed boolean,
  current_count integer,
  remaining integer,
  reset_ms integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_interval interval := (p_window_ms || ' milliseconds')::interval;
  v_record public.api_rate_limits%ROWTYPE;
  v_allowed boolean;
  v_remaining integer;
  v_reset_ms integer;
BEGIN
  -- Insert or update atomically with row lock
  INSERT INTO public.api_rate_limits (key, count, reset_at, created_at, updated_at)
  VALUES (p_key, 1, v_now + v_window_interval, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN api_rate_limits.reset_at <= v_now THEN 1
      ELSE api_rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN api_rate_limits.reset_at <= v_now THEN v_now + v_window_interval
      ELSE api_rate_limits.reset_at
    END,
    updated_at = v_now
  RETURNING * INTO v_record;

  -- Determine if allowed
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
