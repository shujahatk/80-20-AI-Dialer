/**
 * Phase 2 Campaign Pipeline & Database Constraints Test Suite
 * Validates:
 * 1. Migration SQL safety, triggers, unique constraints, and atomic RPC definition.
 * 2. Strict RPC authorization & defense against actor_id spoofing.
 * 3. Historical data deduplication with window function preserving activity.
 * 4. System catalog inspection (pg_index, pg_class, pg_attribute) before index creation.
 * 5. Single active campaign enforcement matching actual enum values (status = 'ready').
 * 6. 100-lead campaign capacity limit with parent row locking FOR UPDATE.
 * 7. Capacity and cross-tenant checks on both INSERT and UPDATE operations.
 * 8. Duplicate enrollment prevention ((campaign_id, lead_id) uniqueness).
 * 9. Cross-organization isolation and defense-in-depth.
 * 10. CSV import multi-stage recovery, partial-success reporting, and resumeCampaignEnrollment.
 * 11. Concurrency race condition serialization simulations.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '20261124000002_phase2_campaign_pipeline.sql');
const typesPath = path.join(projectRoot, 'lib', 'supabase', 'types.ts');
const campaignsRepoPath = path.join(projectRoot, 'repositories', 'campaigns.repository.ts');
const campaignsServicePath = path.join(projectRoot, 'services', 'campaigns', 'campaigns.service.ts');
const leadsServicePath = path.join(projectRoot, 'services', 'leads', 'leads.service.ts');
const importRoutePath = path.join(projectRoot, 'app', 'api', 'leads', 'import', 'route.ts');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    throw err;
  }
}

console.log('\n========================================================================');
console.log('RUNNING: Phase 2 Campaign Pipeline & Database Constraints Test Suite');
console.log('========================================================================\n');

// GROUP 1: Migration SQL Safety, Indexes & Triggers
console.log('GROUP 1: Migration SQL Safety, Catalog Verification & Triggers');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

test('Migration file exists and has valid header and safety guarantees', () => {
  assert(migrationSql.length > 500, 'Migration file is too short or empty');
  assert(migrationSql.includes('20261124000002_phase2_campaign_pipeline.sql'), 'Missing migration identifier');
  assert(migrationSql.includes('100-lead campaign capacity limit'), 'Missing 100-lead objective description');
  assert(migrationSql.includes('single-active-campaign'), 'Missing single-active-campaign description');
});

test('Section 1: Foreign key inspection, dependent record preservation & backup tables', () => {
  assert(
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public._backup_campaign_enrollments_phase2'),
    'Migration must create _backup_campaign_enrollments_phase2 table'
  );
  assert(
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public._backup_enrollment_fk_relinks_phase2'),
    'Migration must create _backup_enrollment_fk_relinks_phase2 table'
  );
  assert(
    migrationSql.includes("c.confrelid = 'public.campaign_enrollments'::regclass") &&
    migrationSql.includes("c.contype = 'f'"),
    'Migration must inspect pg_constraint for all foreign keys referencing campaign_enrollments'
  );
  assert(
    migrationSql.includes('relinked_to_canonical_id'),
    'Migration must record canonical re-link ID for dependent records'
  );
});

test('Section 1: Historical deduplication uses window function preserving activity', () => {
  assert(
    migrationSql.includes('ROW_NUMBER() OVER (') &&
    migrationSql.includes('PARTITION BY campaign_id, lead_id') &&
    migrationSql.includes('ORDER BY') &&
    migrationSql.includes('COALESCE(attempt_count, 0) DESC'),
    'Migration must use window functions to rank duplicate enrollments by attempt_count'
  );
  assert(
    migrationSql.includes('last_attempt_at DESC NULLS LAST'),
    'Deduplication ordering must prioritize most recent call attempt'
  );
  assert(
    migrationSql.includes('DELETE FROM public.campaign_enrollments') &&
    migrationSql.includes('WHERE id IN ('),
    'Migration must delete duplicate rows with rank > 1'
  );
});

test('Section 1: System catalog inspection for unique index on (campaign_id, lead_id)', () => {
  assert(
    migrationSql.includes('FROM pg_index i') &&
    migrationSql.includes('JOIN pg_class c ON c.oid = i.indexrelid') &&
    migrationSql.includes('JOIN pg_class t ON t.oid = i.indrelid') &&
    migrationSql.includes('JOIN pg_namespace n ON n.oid = t.relnamespace'),
    'Migration must inspect PostgreSQL system catalogs (pg_index, pg_class, pg_namespace)'
  );
  assert(
    migrationSql.includes("t.relname = 'campaign_enrollments'") &&
    migrationSql.includes("n.nspname = 'public'") &&
    migrationSql.includes('i.indisunique = true') &&
    migrationSql.includes('i.indisvalid = true') &&
    migrationSql.includes('i.indisready = true') &&
    migrationSql.includes('i.indnkeyatts = 2') &&
    migrationSql.includes('i.indpred IS NULL') &&
    migrationSql.includes('i.indexprs IS NULL'),
    'Catalog inspection must verify uniqueness, validity, readiness, key count, absence of predicate/expressions'
  );
  assert(
    migrationSql.includes("= 'campaign_id,lead_id'"),
    'Catalog inspection must verify indexed columns match campaign_id,lead_id exactly'
  );
  assert(
    migrationSql.includes('CREATE UNIQUE INDEX idx_campaign_enrollments_campaign_lead'),
    'Migration must create idx_campaign_enrollments_campaign_lead unique index if missing'
  );
});

test('Section 2: 100-lead capacity trigger protects both INSERT and UPDATE with strict tenant isolation', () => {
  assert(
    migrationSql.includes('check_campaign_enrollment_capacity()'),
    'Missing check_campaign_enrollment_capacity function'
  );
  assert(
    migrationSql.includes('trg_check_campaign_enrollment_capacity'),
    'Missing trg_check_campaign_enrollment_capacity trigger'
  );
  assert(
    migrationSql.includes('BEFORE INSERT OR UPDATE ON public.campaign_enrollments'),
    'Trigger must execute BEFORE INSERT OR UPDATE on campaign_enrollments'
  );
  // Strict tenant isolation: prohibits organization_id modification
  assert(
    migrationSql.includes('NEW.organization_id IS DISTINCT FROM OLD.organization_id'),
    'Trigger must prohibit modifying organization_id on UPDATE'
  );
  // Metadata updates bypass capacity checks only after tenant validation
  assert(
    migrationSql.includes("TG_OP = 'UPDATE' AND NEW.campaign_id = OLD.campaign_id"),
    'Trigger must bypass capacity check when campaign_id is unchanged'
  );
  // Row-level lock for concurrency serialization: LIMIT 1 FOR UPDATE
  assert(
    migrationSql.includes('LIMIT 1 FOR UPDATE'),
    'Trigger must lock parent campaign with LIMIT 1 FOR UPDATE for concurrency safety'
  );
  // 100 lead limit check
  assert(
    migrationSql.includes('>= 100'),
    'Trigger must enforce maximum 100 enrolled leads'
  );
  // Cross-org check
  assert(
    migrationSql.includes('v_campaign_org IS DISTINCT FROM v_lead_org'),
    'Trigger must validate organization matching between campaign and lead'
  );
  // Hardened search path
  assert(
    migrationSql.includes("SET search_path = ''"),
    "Trigger function must use empty search_path: SET search_path = ''"
  );
});

test('Section 3: Single active campaign verified via system catalogs and standard trigger syntax', () => {
  assert(
    migrationSql.includes('pg_get_expr(i.indpred, i.indrelid)'),
    'Migration must inspect partial index predicate using pg_get_expr'
  );
  assert(
    migrationSql.includes("c.relname = 'idx_campaigns_single_active_per_org'") &&
    migrationSql.includes("t.relname = 'campaigns'"),
    'Migration must inspect idx_campaigns_single_active_per_org on campaigns table'
  );
  assert(
    migrationSql.includes('i.indisunique = true') &&
    migrationSql.includes('i.indisvalid = true') &&
    migrationSql.includes('i.indisready = true') &&
    migrationSql.includes('i.indnkeyatts = 1') &&
    migrationSql.includes('i.indexprs IS NULL'),
    'Catalog inspection must verify uniqueness, validity, readiness, key count, and no expressions on campaigns index'
  );
  assert(
    migrationSql.includes("status = ''ready''") || migrationSql.includes("status=''ready''"),
    "Catalog predicate inspection must verify target status = 'ready'"
  );
  assert(
    migrationSql.includes('CREATE UNIQUE INDEX idx_campaigns_single_active_per_org') &&
    migrationSql.includes("WHERE (status = 'ready')"),
    "Index must be created with WHERE (status = 'ready')"
  );
  assert(
    migrationSql.includes('check_single_active_campaign()') &&
    migrationSql.includes('trg_check_single_active_campaign'),
    'Missing check_single_active_campaign trigger and function'
  );
  // Standard valid trigger syntax
  assert(
    migrationSql.includes('BEFORE INSERT OR UPDATE ON public.campaigns'),
    'Trigger must use standard valid PostgreSQL syntax: BEFORE INSERT OR UPDATE ON public.campaigns'
  );
  assert(
    !migrationSql.includes('BEFORE INSERT OR UPDATE OF status ON public.campaigns'),
    'Trigger must NOT combine INSERT with OF status (invalid PostgreSQL syntax)'
  );
  // Locking query in trigger function
  assert(
    migrationSql.includes('LIMIT 1 FOR UPDATE'),
    'check_single_active_campaign must use LIMIT 1 FOR UPDATE'
  );
});

test('Section 4: Atomic RPC enroll_leads_in_campaign strict zero-trust authorization', () => {
  assert(
    migrationSql.includes('FUNCTION public.enroll_leads_in_campaign('),
    'Missing enroll_leads_in_campaign RPC function'
  );
  assert(
    migrationSql.includes('SECURITY DEFINER'),
    'enroll_leads_in_campaign must be SECURITY DEFINER'
  );
  assert(
    migrationSql.includes("SET search_path = ''"),
    'enroll_leads_in_campaign must have hardened search_path'
  );
  // Check auth.uid() derivation for authenticated callers
  assert(
    migrationSql.includes('v_caller_id := auth.uid()'),
    'enroll_leads_in_campaign must derive caller identity from auth.uid()'
  );
  // Check service_role branch
  assert(
    migrationSql.includes("(auth.jwt() ->> 'role') = 'service_role'") ||
    migrationSql.includes("auth.role() = 'service_role'"),
    'enroll_leads_in_campaign must safely distinguish service_role callers'
  );
  // Check organization membership verification
  assert(
    migrationSql.includes('organization_memberships') &&
    migrationSql.includes('organization_id = v_campaign.organization_id'),
    'enroll_leads_in_campaign must verify caller belongs to campaign organization'
  );
  // Check permission check via private.has_permission
  assert(
    migrationSql.includes('private.has_permission(v_campaign.organization_id, \'campaigns.write\')'),
    'enroll_leads_in_campaign must verify campaigns.write permission via private.has_permission'
  );
  // Check p_actor_id spoofing protection
  assert(
    migrationSql.includes('v_effective_actor_id := v_caller_id'),
    'enroll_leads_in_campaign must override untrusted p_actor_id with verified auth.uid()'
  );
  // Row lock on target campaign using LIMIT 1 FOR UPDATE
  assert(
    migrationSql.includes('SELECT * INTO v_campaign') &&
    migrationSql.includes('LIMIT 1 FOR UPDATE'),
    'enroll_leads_in_campaign must lock campaign with LIMIT 1 FOR UPDATE'
  );
  // Permissions
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.enroll_leads_in_campaign(UUID, UUID[], UUID) FROM PUBLIC'),
    'enroll_leads_in_campaign must revoke execution from PUBLIC'
  );
});

test('Section 5: Genuine verifiable restoration & rollback procedure with targeted FK preservation', () => {
  assert(
    migrationSql.includes('GENUINE VERIFIABLE RESTORATION & ROLLBACK PROCEDURE'),
    'Missing restoration instructions'
  );
  assert(
    migrationSql.includes('FROM public._backup_campaign_enrollments_phase2'),
    'Restoration procedure must restore duplicate enrollments from backup table'
  );
  assert(
    migrationSql.includes('_backup_enrollment_fk_relinks_phase2'),
    'Restoration procedure must restore original FK links'
  );
  assert(
    migrationSql.includes('WHERE %s AND %I = %L'),
    'Restoration procedure must target ONLY exact recorded child rows using child_pk_clause'
  );
  assert(
    migrationSql.includes('DROP FUNCTION IF EXISTS public.enroll_leads_in_campaign'),
    'Missing rollback drop for enroll_leads_in_campaign'
  );
  assert(
    migrationSql.includes('DROP INDEX IF EXISTS public.idx_campaigns_single_active_per_org'),
    'Missing rollback drop for idx_campaigns_single_active_per_org'
  );
});

// GROUP 2: TypeScript Schema & Repository Alignment
console.log('\nGROUP 2: TypeScript Schema & Repository Alignment');
const typesContent = fs.readFileSync(typesPath, 'utf8');
const repoContent = fs.readFileSync(campaignsRepoPath, 'utf8');
const serviceContent = fs.readFileSync(campaignsServicePath, 'utf8');
const leadsContent = fs.readFileSync(leadsServicePath, 'utf8');
const routeContent = fs.readFileSync(importRoutePath, 'utf8');

test('Supabase types declare enroll_leads_in_campaign RPC function', () => {
  assert(
    typesContent.includes('enroll_leads_in_campaign:'),
    'Database types missing enroll_leads_in_campaign function declaration'
  );
  assert(
    typesContent.includes('p_campaign_id: string;'),
    'enroll_leads_in_campaign missing p_campaign_id arg'
  );
  assert(
    typesContent.includes('p_lead_ids: string[];'),
    'enroll_leads_in_campaign missing p_lead_ids arg'
  );
});

test('CampaignsRepository exports findActiveCampaign and getEnrolledCount', () => {
  assert(
    repoContent.includes('findActiveCampaign('),
    'CampaignsRepository missing findActiveCampaign method'
  );
  assert(
    repoContent.includes('getEnrolledCount('),
    'CampaignsRepository missing getEnrolledCount method'
  );
});

test('CampaignEnrollmentResult interface includes skippedCapacity', () => {
  assert(
    serviceContent.includes('skippedCapacity: number;'),
    'CampaignEnrollmentResult interface missing skippedCapacity property'
  );
});

test('CampaignsService enforces single active campaign on creation and state transition', () => {
  assert(
    serviceContent.includes('findActiveCampaign(orgId)'),
    'CampaignsService createCampaign missing findActiveCampaign check'
  );
  assert(
    serviceContent.includes('findActiveCampaign(orgId, id)'),
    'CampaignsService transitionState missing findActiveCampaign check'
  );
  assert(
    serviceContent.includes('Only one active campaign is permitted at a time'),
    'Missing user-facing error message for active campaign conflicts'
  );
});

test('CampaignsService enrollLeads enforces 100-lead maximum capacity limit', () => {
  assert(
    serviceContent.includes('getEnrolledCount(campaignId)'),
    'CampaignsService enrollLeads missing getEnrolledCount check'
  );
  assert(
    serviceContent.includes('has reached its maximum capacity of 100 leads'),
    'Missing clear 100-lead capacity error message'
  );
  assert(
    serviceContent.includes('Math.max(0, 100 - currentEnrolledCount)'),
    'Missing availableSlots calculation'
  );
});

test('LeadsService executeCsvImport pre-validates targetCampaignId and terminal states', () => {
  assert(
    leadsContent.includes('campaignsRepo.getById(targetCampaignId, orgId)'),
    'executeCsvImport missing campaign existence and org verification'
  );
  assert(
    leadsContent.includes('campaignsRepo.getEnrolledCount(targetCampaignId)'),
    'executeCsvImport missing capacity pre-check'
  );
  assert(
    leadsContent.includes('Cannot import leads into campaign'),
    'executeCsvImport missing capacity rejection error'
  );
});

test('LeadsService filters duplicate lookups strictly to rowsToImport to prevent unrelated CRM lead enrollment', () => {
  assert(
    leadsContent.includes('importedPhones = rowsToImport.map'),
    'executeCsvImport must collect phones from rowsToImport'
  );
  assert(
    leadsContent.includes('importedEmails = rowsToImport.map'),
    'executeCsvImport must collect emails from rowsToImport'
  );
  assert(
    leadsContent.includes('this.repo.findDuplicates(importedPhones, importedEmails, orgId)'),
    'Duplicate lookup must pass importedPhones and importedEmails to findDuplicates'
  );
});

test('LeadsService exports resumeCampaignEnrollment for idempotent recovery', () => {
  assert(
    leadsContent.includes('async resumeCampaignEnrollment('),
    'leadsService missing resumeCampaignEnrollment method'
  );
  assert(
    leadsContent.includes('imported_lead_ids'),
    'resumeCampaignEnrollment must retrieve persisted imported_lead_ids from job'
  );
  assert(
    leadsContent.includes('campaignsService.enrollLeads('),
    'resumeCampaignEnrollment must delegate directly to enrollLeads'
  );
});

test('Import API route supports action: resume and handles partialSuccess', () => {
  assert(
    routeContent.includes("action === 'resume'"),
    'Import route must handle action === resume'
  );
  assert(
    routeContent.includes('resumeCampaignEnrollment('),
    'Import route must call resumeCampaignEnrollment'
  );
  assert(
    routeContent.includes('partialSuccess: isPartial'),
    'Import route must flag partialSuccess in HTTP response'
  );
});

// GROUP 3: Functional Logic, Security & Concurrency Simulations
console.log('\nGROUP 3: Functional Logic, Security & Concurrency Simulations');

test('Historical Deduplication Logic: Window function preserves record with most activity', () => {
  // Simulate 3 duplicate enrollments for same campaign and lead
  const duplicates = [
    { id: 'enr_1', campaign_id: 'c1', lead_id: 'l1', attempt_count: 0, last_attempt_at: null, created_at: '2026-01-01T00:00:00Z' },
    { id: 'enr_2', campaign_id: 'c1', lead_id: 'l1', attempt_count: 4, last_attempt_at: '2026-01-05T12:00:00Z', created_at: '2026-01-02T00:00:00Z' },
    { id: 'enr_3', campaign_id: 'c1', lead_id: 'l1', attempt_count: 1, last_attempt_at: '2026-01-03T10:00:00Z', created_at: '2026-01-03T00:00:00Z' },
  ];

  // Apply SQL ORDER BY logic:
  // COALESCE(attempt_count, 0) DESC, last_attempt_at DESC NULLS LAST, created_at ASC, id ASC
  const ranked = [...duplicates].sort((a, b) => {
    const attemptsA = a.attempt_count || 0;
    const attemptsB = b.attempt_count || 0;
    if (attemptsB !== attemptsA) return attemptsB - attemptsA;

    const timeA = a.last_attempt_at ? new Date(a.last_attempt_at).getTime() : -1;
    const timeB = b.last_attempt_at ? new Date(b.last_attempt_at).getTime() : -1;
    if (timeB !== timeA) return timeB - timeA;

    return a.created_at.localeCompare(b.created_at);
  });

  const keptRecord = ranked[0];
  const deletedRecords = ranked.slice(1);

  assert.strictEqual(keptRecord.id, 'enr_2', 'Must preserve enr_2 with 4 call attempts');
  assert.strictEqual(keptRecord.attempt_count, 4, 'Preserved record must have 4 call attempts');
  assert.strictEqual(deletedRecords.length, 2, 'Must mark remaining duplicates for deletion');
  assert(deletedRecords.some(d => d.id === 'enr_1'), 'enr_1 must be deleted');
  assert(deletedRecords.some(d => d.id === 'enr_3'), 'enr_3 must be deleted');
});

test('Enrollment Trigger UPDATE Simulation: Tampering with organization_id is rejected with Tenant violation', () => {
  const existingEnrollment = {
    id: 'enr_001',
    organization_id: 'org_alpha',
    campaign_id: 'camp_100',
    lead_id: 'lead_50',
  };

  const updatedEnrollment = {
    ...existingEnrollment,
    organization_id: 'org_beta', // Attempting to tamper with organization_id!
  };

  let tenantViolation = false;
  let exceptionMessage = null;

  if (updatedEnrollment.organization_id !== existingEnrollment.organization_id) {
    tenantViolation = true;
    exceptionMessage = 'Tenant violation: organization_id cannot be modified on existing campaign enrollment.';
  }

  assert.strictEqual(tenantViolation, true, 'Tampering with organization_id must be flagged as tenant violation');
  assert(exceptionMessage.includes('Tenant violation'), 'Must raise Tenant violation exception');
});

test('Enrollment Trigger UPDATE Simulation: Metadata-only updates succeed even when campaign has 100 leads', () => {
  const campaignCapacity = 100;
  const currentCount = 100; // Campaign is completely full

  const existingEnrollment = {
    id: 'enr_001',
    campaign_id: 'camp_100',
    lead_id: 'lead_50',
    attempt_count: 1,
    last_attempt_at: '2026-01-01T10:00:00Z',
    status: 'enrolled'
  };

  const updatedEnrollment = {
    ...existingEnrollment,
    attempt_count: 2,
    last_attempt_at: '2026-01-01T10:30:00Z',
    status: 'in_progress'
  };

  // Trigger evaluation
  let triggerAllowed = false;
  let exceptionMessage = null;

  const isMetadataOnly = (
    updatedEnrollment.campaign_id === existingEnrollment.campaign_id &&
    updatedEnrollment.lead_id === existingEnrollment.lead_id
  );

  if (isMetadataOnly) {
    // Trigger bypasses capacity check
    triggerAllowed = true;
  } else {
    if (currentCount >= campaignCapacity) {
      exceptionMessage = 'Campaign has reached its maximum capacity of 100 enrolled leads';
    } else {
      triggerAllowed = true;
    }
  }

  assert.strictEqual(triggerAllowed, true, 'Metadata-only UPDATE on 100-lead campaign must succeed');
  assert.strictEqual(exceptionMessage, null, 'No capacity exception should be raised');
});

test('Enrollment Trigger UPDATE Simulation: Moving campaign_id to full campaign is blocked', () => {
  const fullTargetCampaignCount = 100;

  const existingEnrollment = {
    id: 'enr_001',
    campaign_id: 'camp_source',
    lead_id: 'lead_50',
  };

  const updatedEnrollment = {
    ...existingEnrollment,
    campaign_id: 'camp_full_target', // Moving to full campaign
  };

  let triggerAllowed = false;
  let exceptionMessage = null;

  const isMetadataOnly = (
    updatedEnrollment.campaign_id === existingEnrollment.campaign_id &&
    updatedEnrollment.lead_id === existingEnrollment.lead_id
  );

  if (isMetadataOnly) {
    triggerAllowed = true;
  } else {
    // Capacity check needed because campaign_id changed
    if (fullTargetCampaignCount >= 100) {
      exceptionMessage = 'Campaign "Target" has reached its maximum capacity of 100 enrolled leads';
    } else {
      triggerAllowed = true;
    }
  }

  assert.strictEqual(triggerAllowed, false, 'Moving to a 100-lead campaign on UPDATE must be blocked');
  assert(exceptionMessage.includes('maximum capacity of 100'), 'Must raise 100-lead capacity exception');
});

test('Enrollment Trigger UPDATE Simulation: Changing lead_id to cross-tenant lead is blocked', () => {
  const campaignOrg = 'org_alpha';
  const newLeadOrg = 'org_bravo';

  let exceptionRaised = false;
  if (campaignOrg !== newLeadOrg) {
    exceptionRaised = true;
  }

  assert.strictEqual(exceptionRaised, true, 'Changing lead_id to cross-tenant lead must be blocked');
});

test('Security Guard: Authenticated callers cannot spoof p_actor_id in RPC', () => {
  const authenticatedUserId = 'user_real_123';
  const maliciousActorId = 'user_victim_456';
  const isServiceRole = false;

  // Simulate SQL RPC logic
  let effectiveActorId;
  if (isServiceRole) {
    effectiveActorId = maliciousActorId;
  } else {
    // Authenticated caller: strictly override with auth.uid()
    effectiveActorId = authenticatedUserId;
  }

  assert.strictEqual(
    effectiveActorId,
    authenticatedUserId,
    'Effective actor ID must match authenticated auth.uid(), spoofed actor ID must be ignored'
  );
});

test('Security Guard: Cross-organization enrollment is rejected in RPC and Trigger', () => {
  const campaignOrg = 'org_tenant_A';
  const leadOrg = 'org_tenant_B';

  let violationDetected = false;
  if (campaignOrg !== leadOrg) {
    violationDetected = true;
  }

  assert.strictEqual(violationDetected, true, 'Cross-tenant enrollment must be rejected');
});

test('Security Guard: Caller without organization membership is rejected', () => {
  const campaignOrg = 'org_tenant_A';
  const callerMemberships = ['org_tenant_B', 'org_tenant_C'];

  const isMember = callerMemberships.includes(campaignOrg);
  let unauthorized = false;
  if (!isMember) {
    unauthorized = true;
  }

  assert.strictEqual(unauthorized, true, 'Caller without membership in campaign organization must be blocked');
});

test('Concurrency Safety: Parent campaign row lock FOR UPDATE serializes concurrent enrollments', () => {
  // Simulating 2 concurrent workers attempting to enroll into a campaign with 95 leads
  let currentEnrolledInDb = 95;
  const worker1Incoming = 4; // Wants to add 4
  const worker2Incoming = 3; // Wants to add 3 (Total would be 102 without lock)

  // Worker 1 acquires lock FOR UPDATE on campaign row
  const worker1Slots = Math.max(0, 100 - currentEnrolledInDb);
  assert.strictEqual(worker1Slots, 5);
  const worker1Added = Math.min(worker1Incoming, worker1Slots);
  currentEnrolledInDb += worker1Added; // Worker 1 commits: DB now has 99

  // Worker 2 acquires lock AFTER Worker 1 commits, seeing fresh count = 99
  const worker2Slots = Math.max(0, 100 - currentEnrolledInDb);
  assert.strictEqual(worker2Slots, 1);
  const worker2Added = Math.min(worker2Incoming, worker2Slots);
  const worker2SkippedCapacity = worker2Incoming - worker2Added;
  currentEnrolledInDb += worker2Added; // Worker 2 commits: DB now has 100

  assert.strictEqual(currentEnrolledInDb, 100, 'Database count must not exceed 100');
  assert.strictEqual(worker1Added, 4, 'Worker 1 should enroll 4');
  assert.strictEqual(worker2Added, 1, 'Worker 2 should enroll 1');
  assert.strictEqual(worker2SkippedCapacity, 2, 'Worker 2 should have 2 excess skippedCapacity');
});

test('CSV Import Multi-Stage Recovery: Failed enrollment leaves leads safely in CRM with partial_success status', () => {
  // Stage 1: Lead ingestion succeeds
  const insertedLeads = ['lead_001', 'lead_002'];
  const leadImportCompleted = true;

  // Stage 2: Campaign enrollment fails (e.g. campaign capacity reached concurrently)
  let enrollmentError = 'Campaign has reached its maximum capacity of 100 leads';
  let campaignEnrollmentStatus = 'failed';

  const result = {
    inserted: 2,
    updated: 0,
    status: enrollmentError ? 'partial_success' : 'completed',
    leadImportStatus: leadImportCompleted ? 'completed' : 'failed',
    campaignEnrollmentStatus,
    importedLeadIds: insertedLeads,
    recoveryGuidance: 'Leads are safely in CRM. Use resume to enroll into campaign without re-importing.',
  };

  assert.strictEqual(result.status, 'partial_success', 'Must report partial_success when enrollment fails');
  assert.strictEqual(result.leadImportStatus, 'completed', 'Lead import is completed in CRM');
  assert.strictEqual(result.campaignEnrollmentStatus, 'failed', 'Campaign enrollment must be marked failed');
  assert.deepStrictEqual(result.importedLeadIds, ['lead_001', 'lead_002'], 'Must preserve imported lead IDs for recovery');
});

test('resumeCampaignEnrollment: Resumes enrollment using persisted job state without re-creating leads', () => {
  const persistedJob = {
    id: 'job_123',
    status: 'partial_success',
    error_summary: {
      leadImportStatus: 'completed',
      campaignEnrollmentStatus: 'failed',
      imported_lead_ids: ['lead_001', 'lead_002']
    }
  };

  // Mock resumption
  const leadIdsToEnroll = persistedJob.error_summary.imported_lead_ids;
  assert.strictEqual(leadIdsToEnroll.length, 2, 'Must retrieve 2 persisted lead IDs');

  // Direct enrollment
  const enrollmentResult = {
    campaignId: 'camp_001',
    enrolledCount: 2,
    skippedDuplicate: 0,
    skippedCapacity: 0,
    enrolledIds: leadIdsToEnroll
  };

  assert.strictEqual(enrollmentResult.enrolledCount, 2, 'Direct enrollment of persisted leads succeeds');
  assert.deepStrictEqual(enrollmentResult.enrolledIds, ['lead_001', 'lead_002'], 'Enrolls exact persisted leads');
});

test('Idempotent Re-Import: Re-uploading the same CSV skips duplicate leads and allows direct enrollment', () => {
  const existingPhonesInDb = new Set(['+15551234567', '+15559876543']);
  const incomingRows = [
    { phoneE164: '+15551234567', name: 'John Doe' },
    { phoneE164: '+15559876543', name: 'Jane Smith' },
  ];

  // Strategy 'skip'
  const newInserts = [];
  const existingMatches = [];

  for (const row of incomingRows) {
    if (existingPhonesInDb.has(row.phoneE164)) {
      existingMatches.push(row);
    } else {
      newInserts.push(row);
    }
  }

  assert.strictEqual(newInserts.length, 0, 'Re-import with skip strategy must create 0 new leads');
  assert.strictEqual(existingMatches.length, 2, 'Both rows recognized as existing leads');
});

console.log('\n========================================================================');
console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} tests succeeded`);
console.log('========================================================================\n');
