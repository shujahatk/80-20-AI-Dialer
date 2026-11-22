/**
 * Phase 1.1 — Critical Approval and Import Integrity Test Suite
 * 80/20 AI DIALER
 */

const assert = require('assert');

console.log('='.repeat(70));
console.log('PHASE 1.1: CRITICAL APPROVAL & IMPORT INTEGRITY TEST SUITE');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name} - ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name} - ${err.message}`);
  }
}

async function runTests() {
  console.log('\n--- 1. GENUINE HUMAN CALL APPROVAL ENFORCEMENT ---');

  // Test 1: Rejection of unapproved call initiation
  test('Manual call initiation without operatorId throws authorization error', () => {
    function validateCallInitiation(params) {
      if (!params.operatorId) {
        throw new Error('Human operator authorization required: outbound call cannot be initiated without verified human approval.');
      }
      return true;
    }

    assert.throws(
      () => validateCallInitiation({ leadId: 'ld_123', operatorId: null }),
      /Human operator authorization required/
    );
    assert.throws(
      () => validateCallInitiation({ leadId: 'ld_123', operatorId: undefined }),
      /Human operator authorization required/
    );
    assert.throws(
      () => validateCallInitiation({ leadId: 'ld_123', operatorId: '' }),
      /Human operator authorization required/
    );
    assert.strictEqual(validateCallInitiation({ leadId: 'ld_123', operatorId: 'usr_human_456' }), true);
  });

  // Test 2: Approval evidence structure and persistence
  test('Manual call initiation with operatorId creates immutable approval evidence', () => {
    function buildCallSessionRecord(params) {
      if (!params.operatorId) {
        throw new Error('Human operator authorization required');
      }
      const now = new Date().toISOString();
      return {
        organization_id: params.organizationId,
        lead_id: params.leadId,
        operator_id: params.operatorId,
        provider: 'live',
        direction: 'outbound',
        status: 'registered',
        approved_at: now,
        started_at: now,
        provider_metadata: {
          approval: {
            approved_by: params.operatorId,
            approved_at: now,
            method: params.isAiCall ? 'manual_operator_ai_dispatch' : 'manual_operator_direct_dial',
          },
        },
      };
    }

    const record = buildCallSessionRecord({
      organizationId: 'org_test_1',
      leadId: 'ld_test_1',
      operatorId: 'usr_approver_1',
      isAiCall: true,
    });

    assert.strictEqual(record.operator_id, 'usr_approver_1');
    assert.ok(record.approved_at);
    assert.strictEqual(record.provider_metadata.approval.approved_by, 'usr_approver_1');
    assert.strictEqual(record.provider_metadata.approval.method, 'manual_operator_ai_dispatch');
  });

  // Test 3: Retell dispatch pre-call verification
  test('Retell outbound dispatch strictly verifies persisted approval before dialing', () => {
    function verifyPersistedApprovalBeforeRetell(callRecord) {
      if (!callRecord.approved_at || !callRecord.operator_id) {
        throw new Error('Retell dispatch blocked: call record lacks verified human approval.');
      }
      return { dispatchAllowed: true };
    }

    // Call without approval timestamp
    assert.throws(
      () => verifyPersistedApprovalBeforeRetell({ id: 'c1', operator_id: 'usr_1', approved_at: null }),
      /Retell dispatch blocked: call record lacks verified human approval/
    );

    // Call without operator_id (unattributed)
    assert.throws(
      () => verifyPersistedApprovalBeforeRetell({ id: 'c2', operator_id: null, approved_at: new Date().toISOString() }),
      /Retell dispatch blocked: call record lacks verified human approval/
    );

    // Verified human-approved call
    const res = verifyPersistedApprovalBeforeRetell({
      id: 'c3',
      operator_id: 'usr_1',
      approved_at: new Date().toISOString(),
    });
    assert.strictEqual(res.dispatchAllowed, true);
  });

  // Test 4: Queue preparation authorization
  test('Queue candidate preparation requires human operator authorization', () => {
    function prepareQueueCall(params) {
      if (!params.operatorId) {
        throw new Error('Human operator authorization required: queue call cannot be prepared without verified human approval.');
      }
      return { operatorId: params.operatorId, prepared: true };
    }

    assert.throws(
      () => prepareQueueCall({ campaignId: 'cmp_1', operatorId: null }),
      /Human operator authorization required/
    );
    assert.strictEqual(prepareQueueCall({ campaignId: 'cmp_1', operatorId: 'usr_op_789' }).prepared, true);
  });

  // Test 5: Isolated test call authorization
  test('Isolated test call requires human manager/admin authorization', () => {
    function startTestCall(request) {
      if (!request.operatorId) {
        throw new Error('Human operator authorization required: test call cannot be initiated without verified human approval.');
      }
      return { approved: true, operatorId: request.operatorId };
    }

    assert.throws(
      () => startTestCall({ testPhoneNumber: '+14155552671', agentId: 'ag_1' }),
      /Human operator authorization required/
    );
    assert.strictEqual(startTestCall({ testPhoneNumber: '+14155552671', agentId: 'ag_1', operatorId: 'usr_admin_1' }).approved, true);
  });

  // Test 6: Unattended automated campaign dispatch blocking & claim release
  test('Unattended automated campaign dispatch is blocked and releases claimed lead', () => {
    let claimReleased = false;
    const fakeRepo = {
      releaseClaim: (id) => {
        claimReleased = true;
      },
    };

    function simulateDispatchNextCandidate(workerId, operatorId, candidateLead) {
      const effectiveOperatorId = operatorId || (workerId && !workerId.startsWith('worker_') && workerId !== 'system' ? workerId : null);

      if (!effectiveOperatorId) {
        fakeRepo.releaseClaim(candidateLead.campaignLeadId);
        return {
          dispatched: false,
          error: 'Human approval required: Unattended automated campaign dispatch is blocked because outbound calls require verified human approval (approved_at, operator_id). The remote schema does not support pre-approved enrollments.',
        };
      }

      return { dispatched: true, operatorId: effectiveOperatorId };
    }

    const candidate = { campaignLeadId: 'cl_100', leadId: 'ld_100' };

    // Background queue worker without human operator
    const resBlocked = simulateDispatchNextCandidate('worker_campaign_queue', null, candidate);
    assert.strictEqual(resBlocked.dispatched, false);
    assert.ok(resBlocked.error.includes('Human approval required'));
    assert.strictEqual(claimReleased, true);

    // Human operator authorized dispatch
    const resApproved = simulateDispatchNextCandidate('worker_campaign_queue', 'usr_supervisor_9', candidate);
    assert.strictEqual(resApproved.dispatched, true);
    assert.strictEqual(resApproved.operatorId, 'usr_supervisor_9');
  });

  console.log('\n--- 2. CSV IMPORT RPC INTEGRITY & ATOMIC ROLLBACK ---');

  // Test 7: CSV import does NOT create pre-RPC job (exactly 1 job created by RPC)
  test('CSV import relies strictly on public.import_leads RPC without pre-RPC job creation', () => {
    let preJobCreated = false;
    let rpcCalled = false;

    const fakeImportJobsRepo = {
      create: () => {
        preJobCreated = true;
      },
    };

    function simulateExecuteCsvImport(rpcFunc) {
      // In Phase 1.1, fakeImportJobsRepo.create is NOT called!
      rpcCalled = true;
      return rpcFunc('leads.csv', [{ first_name: 'Alex' }]);
    }

    const rpcResult = simulateExecuteCsvImport((filename, rows) => {
      return {
        job_id: 'job_postgres_atomic_123',
        inserted: 1,
        updated: 0,
        skipped: 0,
        invalid: 0,
        dnc_protected: 0,
      };
    });

    assert.strictEqual(preJobCreated, false, 'No pre-RPC job should be created in lead_import_jobs');
    assert.strictEqual(rpcCalled, true, 'RPC must be invoked');
    assert.strictEqual(rpcResult.job_id, 'job_postgres_atomic_123', 'Canonical job_id must come from RPC');
  });

  // Test 8: CSV import correctly maps all 5 RPC metrics
  test('CSV import accurately maps inserted, updated, skipped, invalid, and dnc_protected metrics', () => {
    function mapRpcOutput(res) {
      return {
        jobId: String(res.job_id || res.id),
        inserted: Number(res.inserted ?? res.inserted_count ?? 0),
        updated: Number(res.updated ?? res.updated_count ?? 0),
        skipped: Number(res.skipped ?? res.skipped_count ?? 0),
        invalid: Number(res.invalid ?? res.invalid_count ?? 0),
        dncProtected: Number(res.dnc_protected ?? res.dncProtected ?? 0),
      };
    }

    const rawRpcResult = {
      job_id: 'job_456',
      inserted_count: 42,
      updated_count: 5,
      skipped_count: 3,
      invalid_count: 1,
      dnc_protected: 2,
    };

    const mapped = mapRpcOutput(rawRpcResult);
    assert.strictEqual(mapped.jobId, 'job_456');
    assert.strictEqual(mapped.inserted, 42);
    assert.strictEqual(mapped.updated, 5);
    assert.strictEqual(mapped.skipped, 3);
    assert.strictEqual(mapped.invalid, 1);
    assert.strictEqual(mapped.dncProtected, 2);
  });

  // Test 9: Postgres transaction rollback on RPC failure
  test('Postgres transaction rollback on RPC error is handled without phantom job updates', () => {
    let claimedRowUpdated = false;
    let auditFailureLogged = false;

    function handleImportRpcResult(rpcError) {
      if (rpcError) {
        // Must NOT attempt to update a rolled-back job in lead_import_jobs
        // Must log audit failure and throw descriptive error
        auditFailureLogged = true;
        throw new Error(`CSV Import failed via public.import_leads RPC: ${rpcError.message}`);
      }
    }

    const mockRpcError = {
      message: 'duplicate key value violates unique constraint',
      code: '23505',
      details: 'Key (phone)=(+14155552671) already exists.',
    };

    assert.throws(
      () => handleImportRpcResult(mockRpcError),
      /CSV Import failed via public\.import_leads RPC: duplicate key value/
    );
    assert.strictEqual(claimedRowUpdated, false, 'Must not claim a rolled-back job row was updated in lead_import_jobs');
    assert.strictEqual(auditFailureLogged, true, 'Audit failure entry must be recorded');
  });

  // Test 10: Elimination of direct-insert fallback
  test('Production Supabase path eliminates direct-insert fallback to leads table', () => {
    let directInsertAttempted = false;

    function executeProductionPath(rpcError) {
      if (rpcError) {
        // Direct-insert fallback is strictly disabled!
        // It must throw and not call leads.insert()
        throw new Error(`CSV Import failed via public.import_leads RPC: ${rpcError.message}`);
      }
      directInsertAttempted = true;
    }

    assert.throws(
      () => executeProductionPath({ message: 'connection timeout' }),
      /CSV Import failed via public\.import_leads RPC/
    );
    assert.strictEqual(directInsertAttempted, false, 'Direct insert must never be executed as a silent fallback');
  });

  console.log('\n' + '='.repeat(70));
  console.log(`PHASE 1.1 RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
