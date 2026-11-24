/**
 * Phase 1 Production Database Foundation Test Suite
 * Validates:
 * 1. Migration structure, idempotency, and foreign key safety.
 * 2. Supabase types and schema alignment.
 * 3. Callbacks repository interface and duplicate prevention.
 * 4. Email template, job, and message schema integrity.
 * 5. Rate limiting logic and atomic RPC contract.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '20261124000001_phase1_production_foundation.sql');
const typesPath = path.join(projectRoot, 'lib', 'supabase', 'types.ts');

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
console.log('RUNNING: Phase 1 Production Database Foundation Test Suite');
console.log('========================================================================\n');

// GROUP 1: Migration Structure & Safety
console.log('GROUP 1: Migration SQL Safety & Constraints');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

test('Migration exists and is non-empty', () => {
  assert(migrationSql.length > 500, 'Migration file should contain substantial SQL');
});

test('Migration never drops existing core production tables', () => {
  assert(!migrationSql.match(/DROP TABLE (IF EXISTS )?public\.(leads|campaigns|call_sessions|organizations|profiles|ai_agents)\b/i),
    'Migration must never drop core tables');
});

test('Migration references verified call_sessions table instead of legacy calls', () => {
  assert(migrationSql.includes('REFERENCES public.call_sessions(id)'),
    'Foreign keys must reference call_sessions(id)');
  assert(!migrationSql.includes('REFERENCES public.calls(id)'),
    'Foreign keys must not reference legacy calls table');
});

test('Migration defines required foundation tables', () => {
  const requiredTables = [
    'api_rate_limits',
    'email_automation_settings',
    'email_templates',
    'email_suppressions',
    'email_jobs',
    'email_messages',
    'email_events',
    'callbacks'
  ];
  for (const table of requiredTables) {
    assert(migrationSql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
      `Migration must define table public.${table}`);
  }
});

test('Migration enables RLS on all new tables', () => {
  const tables = [
    'api_rate_limits',
    'email_automation_settings',
    'email_templates',
    'email_suppressions',
    'email_jobs',
    'email_messages',
    'email_events',
    'callbacks'
  ];
  for (const table of tables) {
    assert(migrationSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`),
      `RLS must be enabled on public.${table}`);
  }
});

test('Migration enforces unique constraint preventing duplicate callbacks per call', () => {
  assert(migrationSql.includes('UNIQUE (organization_id, call_session_id)'),
    'Callbacks table must enforce UNIQUE (organization_id, call_session_id)');
});

test('Migration enforces unique constraint preventing duplicate email jobs', () => {
  assert(migrationSql.includes('UNIQUE (organization_id, idempotency_key)'),
    'Email jobs table must enforce UNIQUE (organization_id, idempotency_key)');
});

test('Migration enforces unique constraint on email suppressions', () => {
  assert(migrationSql.includes('UNIQUE (organization_id, email)'),
    'Suppressions must enforce UNIQUE (organization_id, email)');
});

test('Migration defines atomic RPC functions', () => {
  assert(migrationSql.includes('FUNCTION public.check_shared_rate_limit'),
    'check_shared_rate_limit function must be defined');
  assert(migrationSql.includes('FUNCTION public.claim_email_job'),
    'claim_email_job function must be defined');
  assert(migrationSql.includes('FUNCTION public.claim_next_campaign_lead'),
    'claim_next_campaign_lead function must be defined');
  assert(migrationSql.includes('FUNCTION public.redact_expired_email_bodies'),
    'redact_expired_email_bodies function must be defined');
});

test('Migration safely creates private schema and permission helper', () => {
  assert(migrationSql.includes('CREATE SCHEMA IF NOT EXISTS private;'),
    'Migration must create private schema safely');
  assert(migrationSql.includes('target_org uuid') && migrationSql.includes('permission_key text'),
    'private.has_permission must preserve exact signature: (target_org uuid, permission_key text)');
  assert(migrationSql.includes('SECURITY DEFINER'),
    'private.has_permission must be SECURITY DEFINER to avoid recursive RLS');
  assert(migrationSql.includes("SET search_path TO ''"),
    'private.has_permission must set empty search_path TO \'\'');
  assert(migrationSql.includes('REVOKE ALL ON FUNCTION private.has_permission(uuid, text) FROM PUBLIC;'),
    'private.has_permission must revoke execute from PUBLIC');
  assert(migrationSql.includes('REVOKE ALL ON FUNCTION private.has_permission(uuid, text) FROM anon;'),
    'private.has_permission must revoke execute from anon');
  assert(migrationSql.includes('GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text) TO authenticated, service_role;'),
    'private.has_permission must grant execute to authenticated and service_role');
  assert(migrationSql.includes('public.organization_memberships') && migrationSql.includes('public.role_permissions'),
    'private.has_permission must query verified organization_memberships and role_permissions');
  assert(!migrationSql.includes('DROP FUNCTION IF EXISTS private.has_permission'),
    'Migration must never use DROP FUNCTION on private.has_permission');
});

test('Migration includes complete recovery & rollback instructions', () => {
  assert(migrationSql.includes('RECOVERY & ROLLBACK INSTRUCTIONS'),
    'Rollback instructions must be included');
  assert(migrationSql.includes('DROP TABLE IF EXISTS public.callbacks'),
    'Rollback must include drop statements for callbacks');
});

// GROUP 2: TypeScript Types & Schema Alignment
console.log('\nGROUP 2: TypeScript Types & Schema Alignment');
const typesContent = fs.readFileSync(typesPath, 'utf8');

test('Database interface includes email_templates table definition', () => {
  assert(typesContent.includes('email_templates: {'), 'types.ts must declare email_templates');
  assert(typesContent.includes('body_html: string'), 'email_templates must have body_html');
  assert(typesContent.includes('is_default: boolean'), 'email_templates must have is_default');
});

test('Database interface includes callbacks table definition', () => {
  assert(typesContent.includes('callbacks: {'), 'types.ts must declare callbacks');
  assert(typesContent.includes('scheduled_for: string'), 'callbacks must declare scheduled_for');
  assert(typesContent.includes('status: CallbackStatusDb'), 'callbacks must use CallbackStatusDb');
});

test('Database interface includes api_rate_limits table definition', () => {
  assert(typesContent.includes('api_rate_limits: {'), 'types.ts must declare api_rate_limits');
  assert(typesContent.includes('reset_at: string'), 'api_rate_limits must declare reset_at');
});

test('Database interface includes email_messages table definition', () => {
  assert(typesContent.includes('email_messages: {'), 'types.ts must declare email_messages');
  assert(typesContent.includes('resend_id: string | null'), 'email_messages must declare resend_id');
});

// GROUP 3: Callbacks Repository Interface
console.log('\nGROUP 3: Callbacks Repository Verification');
const callbacksRepoPath = path.join(projectRoot, 'repositories', 'callbacks.repository.ts');

test('CallbacksRepository file exists', () => {
  assert(fs.existsSync(callbacksRepoPath), 'callbacks.repository.ts must exist');
});

const callbacksRepoContent = fs.readFileSync(callbacksRepoPath, 'utf8');

test('CallbacksRepository implements list, create, updateStatus, and countPending', () => {
  assert(callbacksRepoContent.includes('async list('), 'Repo must implement list');
  assert(callbacksRepoContent.includes('async create('), 'Repo must implement create');
  assert(callbacksRepoContent.includes('async updateStatus('), 'Repo must implement updateStatus');
  assert(callbacksRepoContent.includes('async countPending('), 'Repo must implement countPending');
});

test('CallbacksRepository queries public.callbacks with tenant isolation', () => {
  assert(callbacksRepoContent.includes(".from('callbacks')"), 'Repo must query callbacks');
  assert(callbacksRepoContent.includes(".eq('organization_id', orgId)"), 'Repo must filter by organization_id');
});

// GROUP 4: Rate Limiting & Integration Safety
console.log('\nGROUP 4: Rate Limiting & Database Operations');
const rateLimitPath = path.join(projectRoot, 'lib', 'security', 'rate-limit.ts');
const rateLimitContent = fs.readFileSync(rateLimitPath, 'utf8');

test('Rate limiter implements atomic check_shared_rate_limit RPC call', () => {
  assert(rateLimitContent.includes("rpc('check_shared_rate_limit'"),
    'checkRateLimit must call check_shared_rate_limit RPC');
});

test('Rate limiter fails closed in production when database service is unavailable', () => {
  assert(rateLimitContent.includes('isUnavailable: true'),
    'Rate limiter must fail closed on critical errors in production');
});

// GROUP 5: Access Control, Record Assignment & Tenant Isolation
console.log('\nGROUP 5: Access Control, Record Assignment & Tenant Isolation');

test('Callbacks select policy enforces assigned_to = auth.uid() for leads.read_assigned users', () => {
  const selectPolicyRegex = /CREATE POLICY "authenticated_callbacks_select"[\s\S]*?USING\s*\(([\s\S]*?)\);/i;
  const match = migrationSql.match(selectPolicyRegex);
  assert(match, 'authenticated_callbacks_select policy must exist');
  const policyBody = match[1];
  
  // Must require assigned_to = auth.uid() when using leads.read_assigned
  assert(policyBody.includes('assigned_to = auth.uid()') && policyBody.includes("'leads.read_assigned'"),
    'Callbacks select policy must bind leads.read_assigned to assigned_to = auth.uid()');
  // Must NOT allow bare leads.read_assigned without assignment check
  assert(!policyBody.match(/private\.has_permission\(organization_id,\s*'leads\.read_assigned'\)\s*(?:OR|\s*$)/i),
    'Callbacks select policy must not permit bare leads.read_assigned without assignment ownership');
});

test('Callbacks select policy permits unrestricted read for leads.read_all users within tenant', () => {
  assert(migrationSql.includes("private.has_permission(organization_id, 'leads.read_all')"),
    'Callbacks select policy must permit leads.read_all within organization');
});

test('Callbacks modify policy enforces assigned_to = auth.uid() for leads.update_assigned users', () => {
  const modifyPolicyRegex = /CREATE POLICY "authenticated_callbacks_modify"[\s\S]*?;/i;
  const match = migrationSql.match(modifyPolicyRegex);
  assert(match, 'authenticated_callbacks_modify policy must exist');
  const policySql = match[0];
  
  assert(policySql.includes('assigned_to = auth.uid()') && policySql.includes("'leads.update_assigned'"),
    'Callbacks modify policy must bind leads.update_assigned to assigned_to = auth.uid()');
  assert(policySql.includes('WITH CHECK'),
    'Callbacks modify policy must include WITH CHECK clause');
  assert(!policySql.match(/USING\s*\(\s*private\.has_permission\(organization_id,\s*'leads\.update_assigned'\)/i),
    'Callbacks modify USING must not permit bare leads.update_assigned without assignment ownership');
});

test('Callbacks modify policy permits unrestricted write for leads.write users within tenant', () => {
  assert(migrationSql.includes("private.has_permission(organization_id, 'leads.write')"),
    'Callbacks modify policy must permit leads.write within organization');
});

test('All new foundation tables strictly enforce organization_id isolation in authenticated policies', () => {
  const tablesWithOrgIsolation = [
    'email_automation_settings',
    'email_templates',
    'email_suppressions',
    'email_jobs',
    'email_messages',
    'email_events',
    'callbacks'
  ];
  for (const table of tablesWithOrgIsolation) {
    const policyRegex = new RegExp(`CREATE POLICY "[^"]*"\\s+ON public\\.${table}[\\s\\S]*?USING\\s*\\(([^)]+organization_id[^)]*)\\)`, 'gi');
    const matches = [...migrationSql.matchAll(policyRegex)];
    assert(matches.length > 0, `Table public.${table} must have authenticated policies scoped to organization_id`);
  }
});

test('private.has_permission strictly guards against null authentication and inputs', () => {
  assert(migrationSql.includes('IF auth.uid() IS NULL THEN') && migrationSql.includes('RETURN false;'),
    'has_permission must fail-closed if auth.uid() is null');
  assert(migrationSql.includes('IF target_org IS NULL OR permission_key IS NULL THEN') && migrationSql.includes('RETURN false;'),
    'has_permission must fail-closed if parameters are null');
});

test('Zero anonymous permissions are granted across all new foundation tables', () => {
  assert(!migrationSql.match(/CREATE POLICY "[^"]*"\s+ON public\.[a-z_]+\s+FOR\s+ALL\s+TO\s+(?:anon|PUBLIC)/i),
    'No table policies must be granted to anon or PUBLIC');
  assert(!migrationSql.match(/GRANT ALL ON public\.[a-z_]+\s+TO\s+(?:anon|PUBLIC)/i),
    'No broad table grants must be awarded to anon or PUBLIC');
});

console.log('\n========================================================================');
console.log(`PHASE 1 DATABASE FOUNDATION SUITE PASSED (${passedTests} / ${totalTests} TESTS)`);
console.log('========================================================================\n');
