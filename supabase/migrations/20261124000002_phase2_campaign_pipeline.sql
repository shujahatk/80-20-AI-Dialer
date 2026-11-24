-- ============================================================================
-- RM AI DIALER: Phase 2 Campaign Pipeline & Database Constraints Migration
-- Migration: 20261124000002_phase2_campaign_pipeline.sql
-- Description: Enforces 100-lead campaign capacity limit (INSERT & UPDATE),
--              single-active-campaign isolation (status = 'ready'),
--              historical duplicate enrollment preservation & cleanup,
--              foreign key inspection and exact child-record re-linking,
--              system catalog index verification (indisunique, indisvalid, indisready, indnkeyatts),
--              cross-org integrity, zero-trust RPC authorization,
--              and genuine verifiable restoration.
--
-- Safety Guarantees:
-- - Exact Child-Record Preservation: Queries pg_constraint for all FKs referencing
--   campaign_enrollments and records the exact primary-key predicate for each child row.
--   Re-links dependent rows to the canonical winner before deduplication.
-- - Verifiable Data Backup: All duplicate records and exact FK re-link predicates
--   are backed up to dedicated tables (_backup_campaign_enrollments_phase2, _backup_enrollment_fk_relinks_phase2).
-- - Targeted Rollback: Restoration updates ONLY the exact child rows recorded in the
--   backup table without touching unrelated child records pointing to the canonical winner.
-- - System Catalog Inspection: Validates indisunique, indisvalid, indisready, indnkeyatts,
--   exact ordered key columns, absence of expressions, and exact partial predicate.
-- - Strict Tenant Isolation on Updates: check_campaign_enrollment_capacity strictly
--   validates tenant matching and prohibits organization_id modification on updates.
-- - Standard Trigger SQL: Uses standard valid PostgreSQL trigger syntax and LIMIT 1 FOR UPDATE.
-- - Zero-Trust RPC Authorization: Derives caller identity from auth.uid() and validates
--   organization membership and campaigns.write/leads.write permissions via private.has_permission().
-- - Hardened Security: All SECURITY DEFINER functions use SET search_path = '' and fully qualified names.
-- - Genuine, verifiable restoration procedure included in Section 5.
-- ============================================================================

-- ============================================================================
-- 1. FOREIGN KEY INSPECTION, EXACT CHILD PRESERVATION, BACKUP & DEDUPLICATION
-- ============================================================================

-- Step 1A: Create backup tables for genuine, verifiable rollback and data recovery
CREATE TABLE IF NOT EXISTS public._backup_campaign_enrollments_phase2 (
  id UUID PRIMARY KEY,
  organization_id UUID,
  campaign_id UUID,
  lead_id UUID,
  enrolled_by UUID,
  attempt_count INTEGER,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  state TEXT,
  claimed_at TIMESTAMPTZ,
  claimed_by UUID,
  claim_expires_at TIMESTAMPTZ,
  outcome TEXT,
  last_call_id UUID,
  final_disposition_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  dedup_rank INTEGER,
  canonical_enrollment_id UUID,
  backed_up_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public._backup_enrollment_fk_relinks_phase2 (
  id BIGSERIAL PRIMARY KEY,
  child_schema TEXT NOT NULL DEFAULT 'public',
  child_table TEXT NOT NULL,
  referencing_column TEXT NOT NULL,
  referencing_columns TEXT[] NOT NULL DEFAULT '{}',
  referenced_columns TEXT[] NOT NULL DEFAULT '{}',
  foreign_key_name TEXT NOT NULL,
  child_pk_clause TEXT NOT NULL,
  original_enrollment_id UUID NOT NULL,
  relinked_to_canonical_id UUID NOT NULL,
  relinked_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure composite columns exist if table was already created in prior run
ALTER TABLE public._backup_enrollment_fk_relinks_phase2 
  ADD COLUMN IF NOT EXISTS referencing_columns TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public._backup_enrollment_fk_relinks_phase2 
  ADD COLUMN IF NOT EXISTS referenced_columns TEXT[] NOT NULL DEFAULT '{}';

-- Step 1B: Identify duplicate enrollments using window function ranking,
-- backup duplicate rows, re-link referencing foreign keys, and safely remove duplicates.
DO $$
DECLARE
  r_dup RECORD;
  r_fk RECORD;
  v_sql TEXT;
  v_pk_expr TEXT;
  v_id_pos INTEGER;
  v_child_id_col TEXT;
  v_k INTEGER;
  v_ref_col TEXT;
  v_dup_val TEXT;
  v_can_val TEXT;
BEGIN
  -- Temporary table of ranked duplicates
  CREATE TEMP TABLE tmp_ranked_enrollments ON COMMIT DROP AS
  SELECT 
    id AS duplicate_id,
    organization_id,
    campaign_id,
    lead_id,
    rank,
    canonical_id
  FROM (
    SELECT 
      id,
      organization_id,
      campaign_id,
      lead_id,
      ROW_NUMBER() OVER (
        PARTITION BY campaign_id, lead_id 
        ORDER BY 
          COALESCE(attempt_count, 0) DESC,
          last_attempt_at DESC NULLS LAST,
          created_at ASC,
          id ASC
      ) as rank,
      FIRST_VALUE(id) OVER (
        PARTITION BY campaign_id, lead_id 
        ORDER BY 
          COALESCE(attempt_count, 0) DESC,
          last_attempt_at DESC NULLS LAST,
          created_at ASC,
          id ASC
      ) as canonical_id
    FROM public.campaign_enrollments
  ) sub
  WHERE rank > 1;

  -- 1. Backup all duplicate records before modification
  INSERT INTO public._backup_campaign_enrollments_phase2 (
    id, organization_id, campaign_id, lead_id, enrolled_by,
    attempt_count, last_attempt_at, next_attempt_at, state,
    claimed_at, claimed_by, claim_expires_at, outcome,
    last_call_id, final_disposition_id, created_at, updated_at,
    dedup_rank, canonical_enrollment_id
  )
  SELECT 
    ce.id, ce.organization_id, ce.campaign_id, ce.lead_id, ce.enrolled_by,
    ce.attempt_count, ce.last_attempt_at, ce.next_attempt_at, ce.state,
    ce.claimed_at, ce.claimed_by, ce.claim_expires_at, ce.outcome,
    ce.last_call_id, ce.final_disposition_id, ce.created_at, ce.updated_at,
    t.rank, t.canonical_id
  FROM tmp_ranked_enrollments t
  JOIN public.campaign_enrollments ce ON ce.id = t.duplicate_id
  ON CONFLICT (id) DO UPDATE SET
    backed_up_at = now(),
    canonical_enrollment_id = EXCLUDED.canonical_enrollment_id;

  -- 2. Inspect all foreign keys referencing public.campaign_enrollments
  -- Inspects EVERY column in each FK constraint, properly supporting single and composite FKs.
  FOR r_fk IN (
    SELECT 
      c.conname AS fk_name,
      n.nspname AS child_schema,
      cl.relname AS child_table,
      cl.oid AS child_oid,
      cardinality(c.conkey) AS fk_col_count,
      (
        SELECT array_agg(a.attname ORDER BY u.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
      ) AS child_columns,
      (
        SELECT array_agg(af.attname ORDER BY u.ord)
        FROM unnest(c.confkey) WITH ORDINALITY AS u(attnum, ord)
        JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = u.attnum
      ) AS referenced_columns
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.confrelid = 'public.campaign_enrollments'::regclass
      AND c.contype = 'f'
  ) LOOP
    -- Validate that FK references 'id'
    v_id_pos := array_position(r_fk.referenced_columns, 'id');
    IF v_id_pos IS NULL THEN
      RAISE EXCEPTION 'Cannot safely re-link foreign key "%" on "%.%": FK does not reference primary key "id" of campaign_enrollments (referenced columns: %).',
        r_fk.fk_name, r_fk.child_schema, r_fk.child_table, r_fk.referenced_columns
        USING ERRCODE = 'feature_not_supported';
    END IF;

    v_child_id_col := r_fk.child_columns[v_id_pos];

    -- For composite FKs, verify all other referenced columns match identically between duplicate and canonical
    IF r_fk.fk_col_count > 1 THEN
      FOR v_k IN 1..r_fk.fk_col_count LOOP
        IF v_k <> v_id_pos THEN
          v_ref_col := r_fk.referenced_columns[v_k];
          FOR r_dup IN SELECT duplicate_id, canonical_id FROM tmp_ranked_enrollments LOOP
            EXECUTE format(
              'SELECT (d.%I)::text, (c.%I)::text FROM public.campaign_enrollments d, public.campaign_enrollments c WHERE d.id = %L AND c.id = %L',
              v_ref_col, v_ref_col, r_dup.duplicate_id, r_dup.canonical_id
            ) INTO v_dup_val, v_can_val;

            IF v_dup_val IS DISTINCT FROM v_can_val THEN
              RAISE EXCEPTION 'Cannot safely re-link composite foreign key "%" on "%.%": referenced column "%" differs between duplicate (%) and canonical (%).',
                r_fk.fk_name, r_fk.child_schema, r_fk.child_table, v_ref_col, r_dup.duplicate_id, r_dup.canonical_id
                USING ERRCODE = 'feature_not_supported';
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;

    -- Determine primary key expression for this child table.
    -- A usable primary key is STRICTLY REQUIRED. CTID fallback is eliminated.
    SELECT string_agg(
      quote_literal(a_pk.attname) || ' || '' = '' || quote_literal(' || quote_ident(a_pk.attname) || '::text)',
      ' || '' AND '' || '
      ORDER BY array_position(c_pk.conkey, a_pk.attnum)
    ) INTO v_pk_expr
    FROM pg_constraint c_pk
    JOIN pg_attribute a_pk ON a_pk.attrelid = c_pk.conrelid AND a_pk.attnum = ANY(c_pk.conkey)
    WHERE c_pk.conrelid = r_fk.child_oid AND c_pk.contype = 'p';

    IF v_pk_expr IS NULL OR v_pk_expr = '' THEN
      RAISE EXCEPTION 'Child table "%.%" referencing campaign_enrollments via foreign key "%" lacks a primary key. A usable primary key is strictly required for verifiable re-linking and rollback.',
        r_fk.child_schema, r_fk.child_table, r_fk.fk_name
        USING ERRCODE = 'invalid_table_definition';
    END IF;

    -- For each duplicate being removed, record exact PK clauses and re-link child rows
    FOR r_dup IN SELECT duplicate_id, canonical_id FROM tmp_ranked_enrollments LOOP
      -- 2A. Record exact child rows that will be re-linked, storing their exact PK predicate
      v_sql := format(
        'INSERT INTO public._backup_enrollment_fk_relinks_phase2 ' ||
        '(child_schema, child_table, referencing_column, referencing_columns, referenced_columns, foreign_key_name, child_pk_clause, original_enrollment_id, relinked_to_canonical_id) ' ||
        'SELECT %L, %L, %L, %L, %L, %L, %s, %L, %L ' ||
        'FROM %I.%I WHERE %I = %L',
        r_fk.child_schema, r_fk.child_table, v_child_id_col, r_fk.child_columns, r_fk.referenced_columns, r_fk.fk_name,
        v_pk_expr,
        r_dup.duplicate_id, r_dup.canonical_id,
        r_fk.child_schema, r_fk.child_table, v_child_id_col, r_dup.duplicate_id
      );
      EXECUTE v_sql;

      -- 2B. Re-link referencing child rows to the canonical enrollment ID
      v_sql := format(
        'UPDATE %I.%I SET %I = %L WHERE %I = %L',
        r_fk.child_schema, r_fk.child_table, v_child_id_col,
        r_dup.canonical_id,
        v_child_id_col, r_dup.duplicate_id
      );
      EXECUTE v_sql;
    END LOOP;
  END LOOP;

  -- 3. Safely delete duplicate enrollments now that all dependent records are preserved and re-linked
  DELETE FROM public.campaign_enrollments
  WHERE id IN (SELECT duplicate_id FROM tmp_ranked_enrollments);
END $$;

-- Step 1C: System Catalog Inspection & Unique Index on (campaign_id, lead_id)
DO $$
DECLARE
  v_enr_idx_name TEXT;
  v_enr_correct BOOLEAN := false;
BEGIN
  -- Inspect pg_index, pg_class, pg_attribute, pg_namespace
  SELECT c.relname INTO v_enr_idx_name
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'campaign_enrollments'
    AND n.nspname = 'public'
    AND i.indisunique = true
    AND i.indisvalid = true
    AND i.indisready = true
    AND i.indnkeyatts = 2
    AND i.indnatts = 2
    AND i.indpred IS NULL
    AND i.indexprs IS NULL
    AND (
      SELECT string_agg(a.attname, ',' ORDER BY array_position(i.indkey, a.attnum))
      FROM pg_attribute a
      WHERE a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    ) = 'campaign_id,lead_id'
  LIMIT 1;

  IF v_enr_idx_name IS NOT NULL THEN
    v_enr_correct := true;
  END IF;

  -- If an index exists with the name 'idx_campaign_enrollments_campaign_lead' but is not correct, drop it
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_campaign_enrollments_campaign_lead'
      AND n.nspname = 'public'
  ) AND NOT v_enr_correct THEN
    EXECUTE 'DROP INDEX public.idx_campaign_enrollments_campaign_lead';
    v_enr_correct := false;
  END IF;

  IF NOT v_enr_correct THEN
    CREATE UNIQUE INDEX idx_campaign_enrollments_campaign_lead
      ON public.campaign_enrollments (campaign_id, lead_id);
  END IF;
END $$;


-- ============================================================================
-- 2. 100-LEAD CAMPAIGN CAPACITY & STRICT TENANT ISOLATION (INSERT & UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_campaign_enrollment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_count INTEGER;
  v_campaign_name TEXT;
  v_campaign_org UUID;
  v_lead_org UUID;
BEGIN
  -- 1. Validate organization match between target campaign and lead (runs on EVERY operation)
  SELECT organization_id, name INTO v_campaign_org, v_campaign_name
  FROM public.campaigns
  WHERE id = NEW.campaign_id;

  IF v_campaign_org IS NULL THEN
    RAISE EXCEPTION 'Target campaign % does not exist.', NEW.campaign_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT organization_id INTO v_lead_org
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_lead_org IS NULL THEN
    RAISE EXCEPTION 'Target lead % does not exist.', NEW.lead_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_campaign_org IS DISTINCT FROM v_lead_org THEN
    RAISE EXCEPTION 'Cross-organization enrollment violation: Lead organization (%) does not match Campaign organization (%).',
      v_lead_org, v_campaign_org
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Strict Tenant Isolation on UPDATE: Prohibit organization_id tampering
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'Tenant violation: organization_id cannot be modified on existing campaign enrollment.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Strictly anchor NEW.organization_id to the verified campaign/lead organization
  NEW.organization_id := v_campaign_org;

  -- 3. Determine if capacity check is needed
  -- On INSERT, capacity check is always required.
  -- On UPDATE:
  --   If campaign_id is unchanged (metadata-only update: attempts, state, outcome),
  --   capacity check is bypassed because the lead was already enrolled in this campaign.
  --   Organization integrity has been strictly validated above.
  IF TG_OP = 'UPDATE' AND NEW.campaign_id = OLD.campaign_id THEN
    RETURN NEW;
  END IF;

  -- 4. Capacity check (INSERT or moving to a different campaign_id on UPDATE)
  -- Concurrency-safe serialization: Lock the target campaign row LIMIT 1 FOR UPDATE
  PERFORM 1 FROM public.campaigns WHERE id = NEW.campaign_id LIMIT 1 FOR UPDATE;

  -- Count active enrollments in target campaign (excluding this row if already in the target campaign)
  SELECT COUNT(*) INTO v_current_count
  FROM public.campaign_enrollments
  WHERE campaign_id = NEW.campaign_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_current_count >= 100 THEN
    RAISE EXCEPTION 'Campaign "%" (ID: %) has reached its maximum capacity of 100 enrolled leads (Current: %).',
      v_campaign_name, NEW.campaign_id, v_current_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_campaign_enrollment_capacity ON public.campaign_enrollments;
CREATE TRIGGER trg_check_campaign_enrollment_capacity
  BEFORE INSERT OR UPDATE ON public.campaign_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_campaign_enrollment_capacity();


-- ============================================================================
-- 3. SINGLE ACTIVE CAMPAIGN ENFORCEMENT & CATALOG VERIFICATION (status = 'ready')
-- ============================================================================

-- Catalog inspection & partial unique index
DO $$
DECLARE
  v_camp_idx_name TEXT;
  v_camp_correct BOOLEAN := false;
BEGIN
  -- Inspect pg_index, pg_class, pg_attribute, pg_namespace
  SELECT c.relname INTO v_camp_idx_name
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'campaigns'
    AND n.nspname = 'public'
    AND i.indisunique = true
    AND i.indisvalid = true
    AND i.indisready = true
    AND i.indnkeyatts = 1
    AND i.indnatts = 1
    AND i.indexprs IS NULL
    AND (
      SELECT string_agg(a.attname, ',' ORDER BY array_position(i.indkey, a.attnum))
      FROM pg_attribute a
      WHERE a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    ) = 'organization_id'
    AND i.indpred IS NOT NULL
    AND (
      -- Exact predicate match: only status = 'ready'
      -- Rejects indexes with additional predicates (AND / OR) or other columns
      replace(replace(replace(lower(pg_get_expr(i.indpred, i.indrelid)), ' ', ''), '(', ''), ')', '') = 'status=''ready'''
      OR replace(replace(replace(lower(pg_get_expr(i.indpred, i.indrelid)), ' ', ''), '(', ''), ')', '') = 'status=''ready''::campaign_status'
      OR replace(replace(replace(lower(pg_get_expr(i.indpred, i.indrelid)), ' ', ''), '(', ''), ')', '') = 'status::text=''ready'''
    )
    AND NOT (lower(pg_get_expr(i.indpred, i.indrelid)) ~ '\y(and|or)\y')
  LIMIT 1;

  IF v_camp_idx_name IS NOT NULL THEN
    v_camp_correct := true;
  END IF;

  -- If an index named 'idx_campaigns_single_active_per_org' exists but is not correct, drop it
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_campaigns_single_active_per_org'
      AND n.nspname = 'public'
  ) AND NOT v_camp_correct THEN
    EXECUTE 'DROP INDEX public.idx_campaigns_single_active_per_org';
    v_camp_correct := false;
  END IF;

  IF NOT v_camp_correct THEN
    CREATE UNIQUE INDEX idx_campaigns_single_active_per_org
      ON public.campaigns (organization_id)
      WHERE (status = 'ready');
  END IF;
END $$;

-- Trigger provides clear, actionable error messaging if an activation conflict occurs
CREATE OR REPLACE FUNCTION public.check_single_active_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active_id UUID;
  v_active_name TEXT;
BEGIN
  -- Evaluate when transitioning into or inserting in the active state ('ready')
  IF NEW.status = 'ready' AND (TG_OP = 'INSERT' OR OLD.status <> 'ready') THEN
    SELECT id, name INTO v_active_id, v_active_name
    FROM public.campaigns
    WHERE organization_id = NEW.organization_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
      AND status = 'ready'
    LIMIT 1 FOR UPDATE;

    IF v_active_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot activate campaign "%": Another campaign ("%", ID: %) is already active in this organization. Only one active campaign is permitted at a time.',
        NEW.name, v_active_name, v_active_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Note: Trigger syntax is BEFORE INSERT OR UPDATE ON public.campaigns (valid standard Postgres)
DROP TRIGGER IF EXISTS trg_check_single_active_campaign ON public.campaigns;
CREATE TRIGGER trg_check_single_active_campaign
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.check_single_active_campaign();


-- ============================================================================
-- 4. ATOMIC CAMPAIGN ENROLLMENT RPC WITH STRICT ZERO-TRUST AUTHORIZATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enroll_leads_in_campaign(
  p_campaign_id UUID,
  p_lead_ids UUID[],
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_service_role BOOLEAN := false;
  v_caller_id UUID;
  v_effective_actor_id UUID;
  v_campaign public.campaigns%ROWTYPE;
  v_current_count INTEGER;
  v_available_slots INTEGER;
  v_lead_id UUID;
  v_lead public.leads%ROWTYPE;
  v_enrolled_count INTEGER := 0;
  v_skipped_duplicate INTEGER := 0;
  v_skipped_dnc INTEGER := 0;
  v_skipped_invalid INTEGER := 0;
  v_skipped_capacity INTEGER := 0;
  v_enrolled_ids UUID[] := '{}';
BEGIN
  -- 1. Determine Caller Identity & Authorization Context
  IF (auth.jwt() ->> 'role') = 'service_role' OR auth.role() = 'service_role' THEN
    v_is_service_role := true;
    v_effective_actor_id := p_actor_id;
  ELSE
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Caller authentication required.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- NEVER trust p_actor_id from an authenticated caller. Always use verified auth.uid().
    v_effective_actor_id := v_caller_id;
  END IF;

  -- 2. Lock and retrieve campaign row for update (LIMIT 1 FOR UPDATE)
  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id
  LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign % not found', p_campaign_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Verify Organization Membership & Enrollment Permission (if not service_role)
  IF NOT v_is_service_role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_memberships
      WHERE organization_id = v_campaign.organization_id
        AND user_id = v_caller_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Caller does not belong to organization %.', v_campaign.organization_id
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT (
      private.has_permission(v_campaign.organization_id, 'campaigns.write') OR
      private.has_permission(v_campaign.organization_id, 'leads.write') OR
      private.has_permission(v_campaign.organization_id, 'org.manage')
    ) THEN
      RAISE EXCEPTION 'Permission Denied: Caller does not possess campaign or lead write permissions in organization %.',
        v_campaign.organization_id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- 4. Check terminal campaign state
  IF v_campaign.status IN ('archived') THEN
    RAISE EXCEPTION 'Cannot enroll leads in campaign "%" with terminal status "%"', v_campaign.name, v_campaign.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Check current capacity
  SELECT COUNT(*) INTO v_current_count
  FROM public.campaign_enrollments
  WHERE campaign_id = p_campaign_id;

  v_available_slots := GREATEST(0, 100 - v_current_count);

  -- 6. Iterate leads and enroll up to available slots
  FOREACH v_lead_id IN ARRAY p_lead_ids LOOP
    SELECT * INTO v_lead
    FROM public.leads
    WHERE id = v_lead_id;

    IF NOT FOUND OR v_lead.deleted_at IS NOT NULL THEN
      v_skipped_invalid := v_skipped_invalid + 1;
      CONTINUE;
    END IF;

    -- Cross-organization check (strictly reject leads from different tenant)
    IF v_lead.organization_id <> v_campaign.organization_id THEN
      RAISE EXCEPTION 'Cross-organization enrollment violation: Lead % belongs to organization % but campaign belongs to %',
        v_lead.id, v_lead.organization_id, v_campaign.organization_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- DNC check
    IF v_lead.do_not_call IS TRUE THEN
      v_skipped_dnc := v_skipped_dnc + 1;
      CONTINUE;
    END IF;

    -- Duplicate check
    IF EXISTS (
      SELECT 1 FROM public.campaign_enrollments
      WHERE campaign_id = p_campaign_id AND lead_id = v_lead_id
    ) THEN
      v_skipped_duplicate := v_skipped_duplicate + 1;
      CONTINUE;
    END IF;

    -- Capacity check
    IF v_enrolled_count >= v_available_slots THEN
      v_skipped_capacity := v_skipped_capacity + 1;
      CONTINUE;
    END IF;

    -- Insert enrollment with verified effective actor
    INSERT INTO public.campaign_enrollments (
      organization_id,
      campaign_id,
      lead_id,
      enrolled_by
    ) VALUES (
      v_campaign.organization_id,
      p_campaign_id,
      v_lead_id,
      v_effective_actor_id
    );

    v_enrolled_count := v_enrolled_count + 1;
    v_enrolled_ids := array_append(v_enrolled_ids, v_lead_id);
  END LOOP;

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'enrolled_count', v_enrolled_count,
    'skipped_duplicate', v_skipped_duplicate,
    'skipped_dnc', v_skipped_dnc,
    'skipped_invalid', v_skipped_invalid,
    'skipped_capacity', v_skipped_capacity,
    'total_enrolled_now', v_current_count + v_enrolled_count,
    'enrolled_ids', to_jsonb(v_enrolled_ids)
  );
END;
$$;

-- Restrict execution: strictly revoke from anon and PUBLIC; grant to authenticated and service_role
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.enroll_leads_in_campaign(UUID, UUID[], UUID) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.enroll_leads_in_campaign(UUID, UUID[], UUID) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enroll_leads_in_campaign(UUID, UUID[], UUID) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enroll_leads_in_campaign(UUID, UUID[], UUID) TO service_role';
  END IF;
END $$;


-- ============================================================================
-- 5. GENUINE VERIFIABLE RESTORATION & ROLLBACK PROCEDURE
-- ============================================================================
-- To restore the database to its exact pre-migration state:
--
-- Step 1: Drop functions, triggers, and indexes:
-- DROP FUNCTION IF EXISTS public.enroll_leads_in_campaign(UUID, UUID[], UUID);
-- DROP TRIGGER IF EXISTS trg_check_single_active_campaign ON public.campaigns;
-- DROP FUNCTION IF EXISTS public.check_single_active_campaign();
-- DROP INDEX IF EXISTS public.idx_campaigns_single_active_per_org;
-- DROP TRIGGER IF EXISTS trg_check_campaign_enrollment_capacity ON public.campaign_enrollments;
-- DROP FUNCTION IF EXISTS public.check_campaign_enrollment_capacity();
-- DROP INDEX IF EXISTS public.idx_campaign_enrollments_campaign_lead;
--
-- Step 2: Restore deleted duplicate enrollments from backup table:
-- INSERT INTO public.campaign_enrollments (
--   id, organization_id, campaign_id, lead_id, enrolled_by,
--   attempt_count, last_attempt_at, next_attempt_at, state,
--   claimed_at, claimed_by, claim_expires_at, outcome,
--   last_call_id, final_disposition_id, created_at, updated_at
-- )
-- SELECT 
--   id, organization_id, campaign_id, lead_id, enrolled_by,
--   attempt_count, last_attempt_at, next_attempt_at, state,
--   claimed_at, claimed_by, claim_expires_at, outcome,
--   last_call_id, final_disposition_id, created_at, updated_at
-- FROM public._backup_campaign_enrollments_phase2
-- ON CONFLICT (id) DO NOTHING;
--
-- Step 3: Revert foreign key re-links back to original duplicate IDs ONLY for the exact recorded child rows:
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM pg_tables 
--     WHERE schemaname = 'public' AND tablename = '_backup_enrollment_fk_relinks_phase2'
--   ) THEN
--     FOR r IN SELECT * FROM public._backup_enrollment_fk_relinks_phase2 LOOP
--       -- Targets ONLY the exact child row matching child_pk_clause AND currently holding relinked_to_canonical_id
--       EXECUTE format(
--         'UPDATE %I.%I SET %I = %L WHERE %s AND %I = %L',
--         r.child_schema, r.child_table, r.referencing_column, r.original_enrollment_id,
--         r.child_pk_clause, r.referencing_column, r.relinked_to_canonical_id
--       );
--     END LOOP;
--   END IF;
-- END $$;
--
-- Step 4: Backup tables remain available for auditing or can be archived.
-- ============================================================================
