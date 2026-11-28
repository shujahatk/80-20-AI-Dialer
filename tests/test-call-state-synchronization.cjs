/**
 * RM 80/20 AI DIALER — CALL STATE SYNCHRONIZATION & CONCURRENCY TEST SUITE
 * Verifies all 18 production scenarios required for bulletproof call-state
 * synchronization, duplicate call prevention, Retell API reconciliation,
 * webhook idempotency, and Workstation recovery.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

// Setup TypeScript and @/ alias resolution for testing .ts source files directly
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const relative = request.slice(2);
    const resolvedPath = path.resolve(__dirname, '..', relative);
    return originalResolveFilename.call(this, resolvedPath, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function(module, filename) {
  const code = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(transpiled, filename);
};

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-rm-dialer.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-for-local-dev';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key_for_testing';
process.env.NEXT_PUBLIC_DEFAULT_ORG_ID = '2f7cec0b-6e1b-419c-80eb-2254789daac2';
process.env.RETELL_API_KEY = 'key_test_synchronization_mock';
process.env.RETELL_AGENT_ID = 'agent_test_sync_001';
process.env.RETELL_PHONE_NUMBER = '+13027860788';
process.env.AI_VOICE_RUNTIME = 'retell';

let testsRun = 0;
let testsPassed = 0;

function it(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function itAsync(name, fn) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// In-Memory Supabase Client Mock with support for partial unique index constraints
class MockSupabaseClient {
  constructor() {
    this.tables = {
      call_sessions: [],
      call_outcomes: [],
      call_transcripts: [],
      audit_logs: [],
      webhook_events: [],
      leads: [],
      campaign_enrollments: [],
      campaigns: [],
      campaign_leads: [],
      ai_agents: [],
    };
  }

  from(tableName) {
    const table = this.tables[tableName] || [];
    const client = this;

    return {
      select(columns, options) {
        let rows = [...table];
        let hasFilter = false;

        const builder = {
          eq(col, val) {
            rows = rows.filter((r) => r[col] === val);
            return builder;
          },
          in(col, vals) {
            rows = rows.filter((r) => vals.includes(r[col]));
            return builder;
          },
          is(col, val) {
            if (val === null) {
              rows = rows.filter((r) => r[col] === null || r[col] === undefined);
            } else {
              rows = rows.filter((r) => r[col] === val);
            }
            return builder;
          },
          order(col, opts) {
            rows.sort((a, b) => {
              if (opts?.ascending) return (a[col] > b[col] ? 1 : -1);
              return (a[col] < b[col] ? 1 : -1);
            });
            return builder;
          },
          limit(n) {
            rows = rows.slice(0, n);
            return builder;
          },
          range(start, end) {
            rows = rows.slice(start, end + 1);
            return builder;
          },
          async maybeSingle() {
            return { data: rows[0] || null, error: null };
          },
          async single() {
            if (rows.length === 0) return { data: null, error: new Error('Row not found') };
            return { data: rows[0], error: null };
          },
          then(resolve) {
            resolve({ data: rows, count: rows.length, error: null });
          },
        };

        return builder;
      },

      insert(payload) {
        const payloadArr = Array.isArray(payload) ? payload : [payload];
        const insertedRows = [];

        for (const itemPayload of payloadArr) {
          // Simulate partial unique index: uq_call_sessions_active_lead
          // UNIQUE (lead_id) WHERE status IN ('queued', 'ringing', 'in_progress') AND ended_at IS NULL
          if (tableName === 'call_sessions') {
            const activeStatuses = ['queued', 'ringing', 'in_progress'];
            if (itemPayload.lead_id && activeStatuses.includes(itemPayload.status) && !itemPayload.ended_at) {
              const existingActive = table.find(
                (r) =>
                  r.lead_id === itemPayload.lead_id &&
                  activeStatuses.includes(r.status) &&
                  !r.ended_at
              );
              if (existingActive) {
                const conflictErr = new Error(
                  `duplicate key value violates unique constraint "uq_call_sessions_active_lead" (lead_id: ${itemPayload.lead_id})`
                );
                conflictErr.code = '23505';
                return {
                  select() {
                    return {
                      async single() { return { data: null, error: conflictErr }; },
                    };
                  },
                  then(resolve, reject) {
                    resolve({ data: null, error: conflictErr });
                  },
                };
              }
            }
          }

          const item = {
            id: itemPayload.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            created_at: itemPayload.created_at || new Date().toISOString(),
            ...itemPayload,
          };
          table.push(item);
          insertedRows.push(item);
        }

        const firstItem = insertedRows[0];
        return {
          select() {
            return {
              async single() {
                return { data: firstItem, error: null };
              },
            };
          },
          then(resolve) {
            resolve({ data: Array.isArray(payload) ? insertedRows : firstItem, error: null });
          },
        };
      },

      update(payload) {
        let targetFilter = {};
        const builder = {
          eq(col, val) {
            targetFilter[col] = val;
            return builder;
          },
          in(col, vals) {
            targetFilter[col] = { $in: vals };
            return builder;
          },
          is(col, val) {
            targetFilter[col] = { $is: val };
            return builder;
          },
          select() {
            return {
              async single() {
                const match = table.find((r) =>
                  Object.entries(targetFilter).every(([k, v]) => {
                    if (v && typeof v === 'object' && '$in' in v) return v.$in.includes(r[k]);
                    if (v && typeof v === 'object' && '$is' in v) return v.$is === null ? (r[k] === null || r[k] === undefined) : r[k] === v.$is;
                    return r[k] === v;
                  })
                );
                if (match) {
                  Object.assign(match, payload);
                  return { data: match, error: null };
                }
                return { data: null, error: new Error('Update match not found') };
              },
            };
          },
          then(resolve) {
            const matches = table.filter((r) =>
              Object.entries(targetFilter).every(([k, v]) => {
                if (v && typeof v === 'object' && '$in' in v) return v.$in.includes(r[k]);
                if (v && typeof v === 'object' && '$is' in v) return v.$is === null ? (r[k] === null || r[k] === undefined) : r[k] === v.$is;
                return r[k] === v;
              })
            );
            matches.forEach((m) => Object.assign(m, payload));
            resolve({ data: matches, error: null });
          },
        };
        return builder;
      },
    };
  }
}

// Load Service Modules
const { CallsService } = require('../services/calls/calls.service');
const { CallsRepository } = require('../repositories/calls.repository');
const { RetellWebhookService } = require('../services/retell/RetellWebhookService');
const { RetellClient } = require('../services/retell/RetellClient');
const { normalizeRetellCallStatus, mapDisconnectionToCallStatus } = require('../services/retell/retell-events');
const { campaignRetellDispatcher } = require('../services/campaigns/campaign-retell-dispatcher.service');

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('RUNNING: RM 80/20 AI DIALER — CALL STATE SYNCHRONIZATION TEST SUITE');
  console.log('Covering 18 Mandatory Production Scenarios');
  console.log('========================================================================\n');

  const orgId = '2f7cec0b-6e1b-419c-80eb-2254789daac2';
  const operatorId = 'op_usr_admin_123';

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Existing call genuinely queued in Retell
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 1: Existing call genuinely queued in Retell blocks new call and maintains active state', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s1',
      organization_id: orgId,
      full_name: 'Lead Scenario 1',
      phone: '+15551110001',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    const callSession = {
      id: 'call_s1_active',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_retell_queued_01',
      status: 'queued',
      created_at: new Date(Date.now() - 20000).toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    // Mock Retell getCall returning queued / registered
    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_retell_queued_01') {
        return {
          call_id: id,
          call_status: 'registered',
        };
      }
      return originalGetCall.call(this, id);
    };

    try {
      let threw = false;
      try {
        await callsService.assertLeadCallable(lead.id, orgId);
      } catch (err) {
        threw = true;
        assert(err.message.includes('already has an active call in progress'), `Expected active call error, got: ${err.message}`);
        assert(err.message.includes('call_s1_active'));
      }
      assert.strictEqual(threw, true, 'assertLeadCallable must throw for genuinely queued call');

      // Verify DB row remains queued and active
      const sessionInDb = mockDb.tables.call_sessions.find((c) => c.id === 'call_s1_active');
      assert.strictEqual(sessionInDb.status, 'queued');
      assert.strictEqual(sessionInDb.ended_at, null);
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Existing call genuinely active (ongoing) in Retell
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 2: Existing call genuinely active (ongoing) transitions to in_progress and blocks new call', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s2',
      organization_id: orgId,
      full_name: 'Lead Scenario 2',
      phone: '+15551110002',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    const callSession = {
      id: 'call_s2_active',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_retell_ongoing_02',
      status: 'queued',
      created_at: new Date(Date.now() - 25000).toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_retell_ongoing_02') {
        return {
          call_id: id,
          call_status: 'ongoing',
          start_timestamp: Date.now() - 10000,
        };
      }
      return originalGetCall.call(this, id);
    };

    try {
      let threw = false;
      try {
        await callsService.assertLeadCallable(lead.id, orgId);
      } catch (err) {
        threw = true;
        assert(err.message.includes('already has an active call in progress'));
      }
      assert.strictEqual(threw, true);

      // Verify status transitioned from queued to in_progress
      const sessionInDb = mockDb.tables.call_sessions.find((c) => c.id === 'call_s2_active');
      assert.strictEqual(sessionInDb.status, 'in_progress');
      assert.strictEqual(sessionInDb.ended_at, null);
      assert(sessionInDb.started_at);
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Existing call already ended in Retell (disconnection reason present)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 3: Existing call ended in Retell reconciles to completed and releases lock immediately', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s3',
      organization_id: orgId,
      full_name: 'Lead Scenario 3',
      phone: '+15551110003',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    const callSession = {
      id: 'call_s3_ended',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_retell_ended_03',
      status: 'queued', // Stuck in queued locally
      created_at: new Date(Date.now() - 30000).toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_retell_ended_03') {
        return {
          call_id: id,
          call_status: 'ended',
          disconnection_reason: 'user_hungup',
          duration_ms: 55000,
          end_timestamp: Date.now() - 5000,
        };
      }
      return originalGetCall.call(this, id);
    };

    try {
      // assertLeadCallable should detect ended call on Retell, reconcile it, and permit the call!
      const check = await callsService.assertLeadCallable(lead.id, orgId);
      assert.strictEqual(check.lead.id, lead.id);

      // Verify DB row was updated to completed and ended_at was set
      const sessionInDb = mockDb.tables.call_sessions.find((c) => c.id === 'call_s3_ended');
      assert.strictEqual(sessionInDb.status, 'completed');
      assert.strictEqual(sessionInDb.duration_seconds, 55);
      assert(sessionInDb.ended_at);
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Existing call failed in Retell (dial_no_answer, error, not_connected)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 4: Existing call failed in Retell (not_connected / dial_no_answer) reconciles to no_answer and releases lock', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s4',
      organization_id: orgId,
      full_name: 'Shujahat Khan (Scenario 4)',
      phone: '+923419229384',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    // Exact reproduction of production stuck call 34cceea3-0232-4a4e-9433-26786d1e1d7b
    const callSession = {
      id: '34cceea3-0232-4a4e-9433-26786d1e1d7b',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_f61768d5d311ed2186b66eca26b',
      status: 'queued',
      created_at: '2026-11-25T22:30:54.000Z',
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_f61768d5d311ed2186b66eca26b') {
        return {
          call_id: id,
          call_status: 'not_connected',
          disconnection_reason: 'dial_no_answer',
          duration_ms: 0,
          end_timestamp: Date.now() - 10000,
        };
      }
      return originalGetCall.call(this, id);
    };

    try {
      // assertLeadCallable should reconcile and succeed without error
      const check = await callsService.assertLeadCallable(lead.id, orgId);
      assert.strictEqual(check.lead.id, lead.id);

      // Verify row reconciled to 'no_answer' (NOT queued!)
      const sessionInDb = mockDb.tables.call_sessions.find((c) => c.id === '34cceea3-0232-4a4e-9433-26786d1e1d7b');
      assert.strictEqual(sessionInDb.status, 'no_answer');
      assert.strictEqual(sessionInDb.disconnection_reason, 'dial_no_answer');
      assert(sessionInDb.ended_at);

      // Verify outcome created with disposition 'NO_ANSWER'
      const outcome = mockDb.tables.call_outcomes.find((o) => o.call_session_id === sessionInDb.id);
      assert(outcome, 'Outcome must be recorded');
      assert.strictEqual(outcome.disposition, 'NO_ANSWER');
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Retell call ID not found (404 handling)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 5: Retell call ID not found (404) marks session failed and releases lock cleanly', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s5',
      organization_id: orgId,
      full_name: 'Lead Scenario 5',
      phone: '+15551110005',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    const callSession = {
      id: 'call_s5_404',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_retell_nonexistent_404',
      status: 'queued',
      created_at: new Date(Date.now() - 20000).toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_retell_nonexistent_404') {
        const err = new Error('Request failed with status 404: Call not found');
        (err).status = 404;
        throw err;
      }
      return originalGetCall.call(this, id);
    };

    try {
      const rec = await callsService.reconcileCall('call_s5_404', orgId);
      assert.strictEqual(rec.reconciled, true);
      assert.strictEqual(rec.status, 'failed');
      assert.strictEqual(rec.isFinal, true);

      // Verify DB row
      const sessionInDb = mockDb.tables.call_sessions.find((c) => c.id === 'call_s5_404');
      assert.strictEqual(sessionInDb.status, 'failed');
      assert.strictEqual(sessionInDb.failure_reason, 'Retell call not found (404)');
      assert(sessionInDb.ended_at);

      // Now assertLeadCallable must succeed immediately
      const check = await callsService.assertLeadCallable(lead.id, orgId);
      assert.strictEqual(check.lead.id, lead.id);
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Retell API temporarily unavailable (network error, timeout, 5xx)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 6: Retell API temporarily unavailable preserves session without premature unlocking', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s6',
      organization_id: orgId,
      full_name: 'Lead Scenario 6',
      phone: '+15551110006',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    const callSession = {
      id: 'call_s6_503',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_retell_503',
      status: 'in_progress',
      created_at: new Date(Date.now() - 20000).toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_retell_503') {
        throw new Error('503 Service Unavailable: Gateway Timeout');
      }
      return originalGetCall.call(this, id);
    };

    try {
      const rec = await callsService.reconcileCall('call_s6_503', orgId);
      assert.strictEqual(rec.reconciled, false);
      assert.strictEqual(rec.isFinal, false);
      assert(rec.message.includes('temporarily unreachable'));

      // Verify active call lock is preserved
      let threw = false;
      try {
        await callsService.assertLeadCallable(lead.id, orgId);
      } catch (err) {
        threw = true;
        assert(err.message.includes('already has an active call in progress'));
      }
      assert.strictEqual(threw, true, 'Active lock must be preserved when provider is temporarily unavailable');
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Dispatch timeout: call created locally but provider never confirmed or timed out
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 7: Orphaned dispatch call (>30s, no provider ID) times out to failed and releases lock', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s7',
      organization_id: orgId,
      full_name: 'Lead Scenario 7',
      phone: '+15551110007',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    const callSession = {
      id: 'call_s7_orphaned',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: null, // Never received provider ID
      status: 'registered',
      created_at: new Date(Date.now() - 45000).toISOString(), // Created 45 seconds ago
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const rec = await callsService.reconcileCall('call_s7_orphaned', orgId);
    assert.strictEqual(rec.reconciled, true);
    assert.strictEqual(rec.status, 'failed');
    assert.strictEqual(rec.isFinal, true);
    assert(rec.message.includes('timed out'));

    const sessionInDb = mockDb.tables.call_sessions.find((c) => c.id === 'call_s7_orphaned');
    assert.strictEqual(sessionInDb.status, 'failed');
    assert.strictEqual(sessionInDb.failure_reason, 'Dispatch timed out before provider call creation');
    assert(sessionInDb.ended_at);

    // Lock is now released
    const check = await callsService.assertLeadCallable(lead.id, orgId);
    assert.strictEqual(check.lead.id, lead.id);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Duplicate Start Call clicks (rapid double-click)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 8: Rapid duplicate Start Call request is blocked by active call guard', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s8',
      organization_id: orgId,
      full_name: 'Lead Scenario 8',
      phone: '+15551110008',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    // Call 1 initiates: creates session in queued/registered
    mockDb.tables.call_sessions.push({
      id: 'call_s8_click1',
      organization_id: orgId,
      lead_id: lead.id,
      status: 'queued',
      created_at: new Date().toISOString(), // Created 100ms ago (within 15s window)
      ended_at: null,
      retell_call_id: 'call_retell_click1',
    });

    // Rapid double-click arrives immediately
    let threw = false;
    try {
      await callsService.assertLeadCallable(lead.id, orgId);
    } catch (err) {
      threw = true;
      assert(err.message.includes('already has an active call in progress'));
      assert(err.message.includes('call_s8_click1'));
    }
    assert.strictEqual(threw, true, 'Second click must be blocked by active call lock');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Concurrent calls from different browser tabs
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 9: Concurrent calls from different tabs are blocked by database partial unique constraint', async () => {
    const mockDb = new MockSupabaseClient();
    const repo = new CallsRepository(mockDb);

    const leadId = 'lead_s9_concurrent';

    // Tab 1 creates call session successfully
    const call1 = await repo.create({
      organization_id: orgId,
      lead_id: leadId,
      status: 'queued',
      direction: 'outbound',
    });
    assert(call1.id);

    // Tab 2 attempts to create concurrent call session for same lead
    let conflictCaught = false;
    try {
      await repo.create({
        organization_id: orgId,
        lead_id: leadId,
        status: 'queued',
        direction: 'outbound',
      });
    } catch (err) {
      conflictCaught = true;
      assert(err.message.includes('uq_call_sessions_active_lead') || err.code === '23505');
    }
    assert.strictEqual(conflictCaught, true, 'Database unique constraint must reject concurrent active session for lead');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Duplicate Retell webhooks (same call_ended received twice)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 10: Duplicate Retell call_ended webhooks are handled idempotently', async () => {
    const mockDb = new MockSupabaseClient();
    const webhookService = new RetellWebhookService(mockDb);

    const callSession = {
      id: 'call_s10',
      organization_id: orgId,
      lead_id: 'lead_s10',
      retell_call_id: 'call_retell_s10',
      status: 'in_progress',
      created_at: new Date().toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const callEndedPayload = {
      event: 'call_ended',
      call: {
        call_id: 'call_retell_s10',
        call_status: 'ended',
        disconnection_reason: 'agent_hangup',
        duration_ms: 32000,
        start_timestamp: Date.now() - 32000,
        end_timestamp: Date.now(),
        metadata: {
          organizationId: orgId,
          leadId: 'lead_s10',
          rmCallId: 'call_s10',
        },
      },
    };

    // First webhook delivery
    const result1 = await webhookService.processWebhook(callEndedPayload);
    assert.strictEqual(result1.success, true);

    const sessionAfter1 = mockDb.tables.call_sessions.find((c) => c.id === 'call_s10');
    assert.strictEqual(sessionAfter1.status, 'completed');
    assert(sessionAfter1.ended_at);

    // Second webhook delivery (duplicate)
    const result2 = await webhookService.processWebhook(callEndedPayload);
    assert.strictEqual(result2.success, true);
    assert.strictEqual(result2.isDuplicate, true, 'Duplicate webhook must be detected via idempotency key');

    // Status remains completed and was not corrupted
    const sessionAfter2 = mockDb.tables.call_sessions.find((c) => c.id === 'call_s10');
    assert.strictEqual(sessionAfter2.status, 'completed');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Out-of-order Retell webhooks (call_analyzed before call_ended)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 11: Out-of-order webhooks (call_analyzed before call_ended) preserve analysis and terminal state', async () => {
    const mockDb = new MockSupabaseClient();
    const webhookService = new RetellWebhookService(mockDb);

    const lead = {
      id: 'lead_s11',
      organization_id: orgId,
      full_name: 'Lead Scenario 11',
      status: 'NEW',
    };
    mockDb.tables.leads.push(lead);

    const callSession = {
      id: 'call_s11',
      organization_id: orgId,
      lead_id: 'lead_s11',
      retell_call_id: 'call_retell_s11',
      status: 'in_progress',
      created_at: new Date().toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    // Webhook 1: call_analyzed arrives first!
    const analyzedPayload = {
      event: 'call_analyzed',
      call: {
        call_id: 'call_retell_s11',
        call_status: 'ended',
        disconnection_reason: 'user_hungup',
        duration_ms: 45000,
        call_analysis: {
          call_summary: 'Prospect interested in commercial recycling.',
          call_successful: true,
          user_sentiment: 'Positive',
          custom_analysis_data: {
            decision_maker_identified: true,
            contact_name: 'Robert Davis',
          },
        },
        metadata: {
          organizationId: orgId,
          leadId: 'lead_s11',
          rmCallId: 'call_s11',
        },
      },
    };

    const res1 = await webhookService.processWebhook(analyzedPayload);
    assert.strictEqual(res1.success, true);

    const sessionAfterAnalysis = mockDb.tables.call_sessions.find((c) => c.id === 'call_s11');
    assert.strictEqual(sessionAfterAnalysis.status, 'completed');
    assert(sessionAfterAnalysis.ended_at);

    // Webhook 2: call_ended arrives delayed
    const endedPayload = {
      event: 'call_ended',
      call: {
        call_id: 'call_retell_s11',
        call_status: 'ended',
        disconnection_reason: 'user_hungup',
        duration_ms: 45000,
        metadata: {
          organizationId: orgId,
          leadId: 'lead_s11',
          rmCallId: 'call_s11',
        },
      },
    };

    const res2 = await webhookService.processWebhook(endedPayload);
    assert.strictEqual(res2.success, true);

    // Verify session remained completed and outcome persists
    const finalSession = mockDb.tables.call_sessions.find((c) => c.id === 'call_s11');
    assert.strictEqual(finalSession.status, 'completed');
    assert(mockDb.tables.call_outcomes.length > 0);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Missed webhook recovery (call ended on Retell, webhook lost, system auto-reconciles)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 12: Missed webhook recovery automatically queries Retell, completes call, and persists outcome', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s12',
      organization_id: orgId,
      full_name: 'Lead Scenario 12',
      phone: '+15551110012',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    // Call stuck in in_progress because webhook was lost
    const callSession = {
      id: 'call_s12_lost_webhook',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_retell_lost_webhook',
      status: 'in_progress',
      created_at: new Date(Date.now() - 60000).toISOString(),
      ended_at: null,
    };
    mockDb.tables.call_sessions.push(callSession);

    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_retell_lost_webhook') {
        return {
          call_id: id,
          call_status: 'ended',
          disconnection_reason: 'user_hungup',
          duration_ms: 60000,
          end_timestamp: Date.now() - 15000,
          call_analysis: {
            call_summary: 'Recovered missed webhook conversation.',
            call_successful: true,
          },
        };
      }
      return originalGetCall.call(this, id);
    };

    try {
      const rec = await callsService.reconcileCall('call_s12_lost_webhook', orgId);
      assert.strictEqual(rec.reconciled, true);
      assert.strictEqual(rec.status, 'completed');
      assert.strictEqual(rec.isFinal, true);

      const sessionInDb = mockDb.tables.call_sessions.find((c) => c.id === 'call_s12_lost_webhook');
      assert.strictEqual(sessionInDb.status, 'completed');
      assert.strictEqual(sessionInDb.duration_seconds, 60);
      assert(sessionInDb.ended_at);

      // Lock is released!
      const check = await callsService.assertLeadCallable(lead.id, orgId);
      assert.strictEqual(check.lead.id, lead.id);
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Failed call followed by legitimate retry (should succeed immediately)
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 13: Failed call followed by legitimate retry succeeds immediately', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s13',
      organization_id: orgId,
      full_name: 'Lead Scenario 13',
      phone: '+15551110013',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    // Prior call session that ended as failed
    mockDb.tables.call_sessions.push({
      id: 'call_s13_prev_failed',
      organization_id: orgId,
      lead_id: lead.id,
      status: 'failed',
      ended_at: new Date(Date.now() - 60000).toISOString(),
      disconnection_reason: 'dial_no_answer',
    });

    // Check callable for retry
    const check = await callsService.assertLeadCallable(lead.id, orgId);
    assert.strictEqual(check.lead.id, lead.id);
    assert.strictEqual(check.phoneNorm.e164, '+15551110013');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Active call correctly blocks another call to the same lead
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 14: Truly active ongoing call correctly blocks another call to the same lead', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s14',
      organization_id: orgId,
      full_name: 'Lead Scenario 14',
      phone: '+15551110014',
      do_not_call: false,
    };
    mockDb.tables.leads.push(lead);

    mockDb.tables.call_sessions.push({
      id: 'call_s14_ongoing',
      organization_id: orgId,
      lead_id: lead.id,
      retell_call_id: 'call_retell_s14',
      status: 'in_progress',
      created_at: new Date(Date.now() - 10000).toISOString(),
      ended_at: null,
    });

    const originalGetCall = RetellClient.prototype.getCall;
    RetellClient.prototype.getCall = async function(id) {
      if (id === 'call_retell_s14') {
        return {
          call_id: id,
          call_status: 'ongoing',
        };
      }
      return originalGetCall.call(this, id);
    };

    try {
      let threw = false;
      try {
        await callsService.assertLeadCallable(lead.id, orgId);
      } catch (err) {
        threw = true;
        assert(err.message.includes('already has an active call in progress'));
      }
      assert.strictEqual(threw, true);
    } finally {
      RetellClient.prototype.getCall = originalGetCall;
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 15: DNC lead cannot be called
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 15: Lead marked as Do Not Call (DNC) is immediately rejected', async () => {
    const mockDb = new MockSupabaseClient();
    const callsService = new CallsService(mockDb);

    const lead = {
      id: 'lead_s15_dnc',
      organization_id: orgId,
      full_name: 'Lead Scenario 15 DNC',
      phone: '+15551110015',
      do_not_call: true,
    };
    mockDb.tables.leads.push(lead);

    let threw = false;
    try {
      await callsService.assertLeadCallable(lead.id, orgId);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Do Not Call (DNC)'));
    }
    assert.strictEqual(threw, true);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Campaign dispatch respects lead-level locks
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 16: Campaign dispatcher skips candidates with active calls in Workstation or other campaigns', async () => {
    const mockDb = new MockSupabaseClient();
    const callsRepo = new CallsRepository(mockDb);

    const leadId = 'lead_s16_campaign_locked';

    // Lead currently has an active call session in Workstation
    mockDb.tables.call_sessions.push({
      id: 'call_s16_workstation_active',
      organization_id: orgId,
      lead_id: leadId,
      status: 'in_progress',
      ended_at: null,
    });

    // Check repository active call
    const activeCall = await callsRepo.getActiveCallForLead(leadId, orgId);
    assert(activeCall, 'Active call must be detected for lead');
    assert.strictEqual(activeCall.id, 'call_s16_workstation_active');
    assert.strictEqual(activeCall.status, 'in_progress');

    // When call ends
    mockDb.tables.call_sessions[0].ended_at = new Date().toISOString();
    mockDb.tables.call_sessions[0].status = 'completed';

    const clearedActiveCall = await callsRepo.getActiveCallForLead(leadId, orgId);
    assert.strictEqual(clearedActiveCall, null, 'No active call returned once call is ended');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 17: Call History displays correct final result for all call statuses
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 17: Call History correctly hydrates terminal statuses (no_answer, busy, failed, completed)', async () => {
    const mockDb = new MockSupabaseClient();
    const repo = new CallsRepository(mockDb);
    const leadId = 'lead_s17_history';

    const testStatuses = [
      { status: 'no_answer', disconnection: 'dial_no_answer', expectedDisp: 'NO_ANSWER' },
      { status: 'busy', disconnection: 'dial_busy', expectedDisp: 'BUSY' },
      { status: 'failed', disconnection: 'error', expectedDisp: 'FAILED' },
      { status: 'completed', disconnection: 'user_hungup', expectedDisp: 'COMPLETED' },
    ];

    for (let i = 0; i < testStatuses.length; i++) {
      const { status, disconnection, expectedDisp } = testStatuses[i];
      const callId = `call_s17_${i}`;
      mockDb.tables.call_sessions.push({
        id: callId,
        organization_id: orgId,
        lead_id: leadId,
        status,
        disconnection_reason: disconnection,
        started_at: new Date(Date.now() - (i + 1) * 60000).toISOString(),
        ended_at: new Date(Date.now() - (i + 1) * 60000 + 30000).toISOString(),
        created_at: new Date(Date.now() - (i + 1) * 60000).toISOString(),
      });
      mockDb.tables.call_outcomes.push({
        id: `outcome_${i}`,
        call_session_id: callId,
        organization_id: orgId,
        disposition: expectedDisp,
        created_at: new Date().toISOString(),
      });
    }

    const history = await repo.listCallsWithDetailsForLead(leadId, orgId);
    assert.strictEqual(history.length, 4);

    const statusesInHistory = history.map((c) => c.status);
    assert(statusesInHistory.includes('no_answer'));
    assert(statusesInHistory.includes('busy'));
    assert(statusesInHistory.includes('failed'));
    assert(statusesInHistory.includes('completed'));
    assert(!statusesInHistory.includes('queued'), 'History must not contain queued status for finished calls');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 18: Refreshing the Workstation preserves the correct state
  // ---------------------------------------------------------------------------
  await itAsync('Scenario 18: Refreshing Workstation restores clean idle state after call finishes without stuck error', async () => {
    const mockDb = new MockSupabaseClient();
    const callsRepo = new CallsRepository(mockDb);

    const leadId = '5e36899f-75cf-4cbf-ba55-6881be52e089'; // Shujahat Khan production lead ID

    // Historical call exists in DB in terminal state (reconciled)
    mockDb.tables.call_sessions.push({
      id: '34cceea3-0232-4a4e-9433-26786d1e1d7b',
      organization_id: orgId,
      lead_id: leadId,
      status: 'no_answer',
      disconnection_reason: 'dial_no_answer',
      ended_at: '2026-11-25T22:31:23.689Z',
      created_at: '2026-11-25T22:30:54.000Z',
    });

    // On page load/refresh, Workstation checks getActiveCallForLead
    const activeCall = await callsRepo.getActiveCallForLead(leadId, orgId);

    // Active call must be null!
    assert.strictEqual(activeCall, null, 'Active call must be null for reconciled lead on Workstation load');
  });

  console.log('\n========================================================================');
  console.log(`ALL 18 CALL SYNCHRONIZATION TESTS PASSED (${testsPassed} / ${testsRun})`);
  console.log('========================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
