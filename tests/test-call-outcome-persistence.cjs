/**
 * RM 80/20 AI DIALER — RETELL CALL OUTCOME -> CRM PERSISTENCE & QUALIFICATION TEST SUITE
 * Verifies end-to-end outcome persistence, deterministic criteria evaluation,
 * idempotent ingestion, out-of-order handling, and Lead Drawer call history hydration.
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

async function runAll() {
  console.log('\n========================================================================');
  console.log('RUNNING: Retell Call Outcome -> CRM Persistence Verification Suite');
  console.log('========================================================================\n');

  // -----------------------------------------------------------------------------
  // 1. DETERMINISTIC QUALIFICATION EVALUATION & CANONICAL OUTCOMES
  // -----------------------------------------------------------------------------
  console.log('1. Canonical Qualification Outcomes (campaign-qualification.service.ts):');

const { evaluateCampaignPostCallQualification } = require('../services/campaigns/campaign-qualification.service');

it('Scenario 1: Full Qualification (DM + Commercial interest + Volume + Grade) -> QUALIFIED', () => {
  const result = evaluateCampaignPostCallQualification({
    callOutcome: 'Interested in bulk purchasing',
    leadStatus: 'Confirmed',
    summary: 'Spoke with VP of Operations. Confirmed monthly requirement for 50 tons of HDPE Regrind.',
    sentiment: 'positive',
    decisionMakerIdentified: true,
    contactName: 'Sarah Jenkins',
    companyName: 'Apex Polymers LLC',
    jobTitle: 'VP Operations',
    emailAddress: 'sjenkins@apexpolymers.com',
    directPhoneNumber: '+15551234567',
    interestLevel: 'high',
    materialInterest: 'HDPE Regrind',
    estimatedVolume: '50 tons/month',
    materialGrade: 'Injection Grade A',
    purchaseIntent: 'Immediate / Q4',
    commercialRequirements: 'Delivered pricing to Chicago plant',
  });

  assert.strictEqual(result.outcome, 'QUALIFIED');
  assert.strictEqual(result.isQualified, true);
  assert.strictEqual(result.recommendedDbStatus, 'TECHNICAL_EVALUATION');
  assert.strictEqual(result.decisionMakerInvolved, true);
  assert.strictEqual(result.materialInterest, 'HDPE Regrind');
  assert.strictEqual(result.estimatedVolume, '50 tons/month');
  assert.strictEqual(result.materialGrade, 'Injection Grade A');
});

it('Scenario 2: Strict Commercial Rule (Contact details captured WITHOUT volume or grade) -> NEEDS_REVIEW (NEVER QUALIFIED)', () => {
  const result = evaluateCampaignPostCallQualification({
    callOutcome: 'Prospect provided email for follow-up',
    leadStatus: 'Confirmed',
    summary: 'Spoke with John Smith, Director. Provided his email and said to send materials overview.',
    sentiment: 'positive',
    decisionMakerIdentified: true,
    contactName: 'John Smith',
    companyName: 'Smith Manufacturing',
    jobTitle: 'Director',
    emailAddress: 'john@smithmfg.com',
    directPhoneNumber: '+15559876543',
    interestLevel: 'high',
    materialInterest: null,
    estimatedVolume: null, // MISSING VOLUME
    materialGrade: null,  // MISSING GRADE
  });

  assert.strictEqual(result.outcome, 'NEEDS_REVIEW', 'Must evaluate to NEEDS_REVIEW when volume/grade are missing');
  assert.strictEqual(result.isQualified, false, 'Must NOT be evaluated as qualified');
  assert.strictEqual(result.recommendedDbStatus, 'ENGAGED', 'Recommended DB status must be ENGAGED');
});

it('Scenario 3: Explicit Lack of Interest -> NOT_INTERESTED / NOT_QUALIFIED', () => {
  const result = evaluateCampaignPostCallQualification({
    callOutcome: 'Not interested at this time',
    leadStatus: 'Not Interested',
    summary: 'Prospect stated they have an exclusive contract and do not buy secondary materials.',
    sentiment: 'negative',
    decisionMakerIdentified: true,
  });

  assert.strictEqual(result.outcome, 'NOT_INTERESTED');
  assert.strictEqual(result.isQualified, false);
});

it('Scenario 4: Callback Requested with Specified Time -> CALLBACK_REQUESTED', () => {
  const result = evaluateCampaignPostCallQualification({
    callOutcome: 'Call back tomorrow at 2 PM',
    summary: 'Prospect is in a meeting. Asked to call back on Wednesday at 2:00 PM EST.',
    sentiment: 'neutral',
    callbackRequested: true,
    callbackTime: 'Wednesday 2:00 PM EST',
  });

  assert.strictEqual(result.outcome, 'CALLBACK_REQUESTED');
  assert.strictEqual(result.callbackRequested, true);
  assert.strictEqual(result.callbackTime, 'Wednesday 2:00 PM EST');
  assert.strictEqual(result.recommendedDbStatus, 'CONTACTED');
});

it('Scenario 5: Follow-Up / Information Request -> FOLLOW_UP_REQUIRED', () => {
  const result = evaluateCampaignPostCallQualification({
    callOutcome: 'Send company deck and pricing sheet',
    summary: 'Prospect asked to email product specifications and follow up next week.',
    sentiment: 'neutral',
    followUpRequirements: 'Send product spec sheet and pricing matrix',
  });

  assert.strictEqual(result.outcome, 'FOLLOW_UP_REQUIRED');
  assert.strictEqual(result.recommendedDbStatus, 'CONTACTED');
});

it('Scenario 6: Voicemail / Answering Machine -> VOICEMAIL', () => {
  const result = evaluateCampaignPostCallQualification({
    inVoicemail: true,
    disconnectionReason: 'voicemail_reached',
    summary: 'Reached voicemail. Left automated introductory message.',
  });

  assert.strictEqual(result.outcome, 'VOICEMAIL');
  assert.strictEqual(result.recommendedDbStatus, 'CONTACTED');
});

it('Scenario 7: Dial No Answer -> NO_ANSWER', () => {
  const result = evaluateCampaignPostCallQualification({
    disconnectionReason: 'dial_no_answer',
    summary: 'Ring timeout after 30 seconds. No answer.',
  });

  assert.strictEqual(result.outcome, 'NO_ANSWER');
  assert.strictEqual(result.recommendedDbStatus, 'CONTACTED');
});

it('Scenario 8: Line Busy -> BUSY', () => {
  const result = evaluateCampaignPostCallQualification({
    disconnectionReason: 'dial_busy',
    summary: 'Line returned busy tone.',
  });

  assert.strictEqual(result.outcome, 'BUSY');
  assert.strictEqual(result.recommendedDbStatus, 'CONTACTED');
});

it('Scenario 9: Call Failed -> FAILED', () => {
  const result = evaluateCampaignPostCallQualification({
    disconnectionReason: 'dial_failed',
    summary: 'Carrier routing error.',
  });

  assert.strictEqual(result.outcome, 'FAILED');
  assert.strictEqual(result.recommendedDbStatus, 'CONTACTED');
});

it('Scenario 10: Prospect Requests DNC -> DO_NOT_CALL', () => {
  const result = evaluateCampaignPostCallQualification({
    dncRequested: true,
    summary: 'Prospect yelled do not call this number again and hung up.',
    sentiment: 'negative',
  });

  assert.strictEqual(result.outcome, 'DO_NOT_CALL');
  assert.strictEqual(result.recommendedDbStatus, 'dnc');
});

// -----------------------------------------------------------------------------
// 2. RETELL MAPPER & COMMERCIAL EXTRACTION
// -----------------------------------------------------------------------------
console.log('\n2. Retell Domain Mapper & Commercial Data Extraction (retell-mapper.ts):');

const { RetellMapper } = require('../services/retell/retell-mapper');

it('Scenario 11: RetellMapper extracts structured commercial parameters from custom_analysis_data', () => {
  const mapped = RetellMapper.mapRetellAnalysisToRM({
    call_summary: 'Comprehensive conversation with VP Procurement.',
    call_successful: true,
    user_sentiment: 'Positive',
    custom_analysis_data: {
      decision_maker_identified: true,
      contact_name: 'David Miller',
      company_name: 'Miller Plastics Corp',
      jobTitle: 'Head of Purchasing',
      email: 'dmiller@millerplastics.com',
      direct_phone: '+14155551234',
      material_interest: 'PET Flakes',
      volume: '100 metric tons/month',
      material_grade: 'Bottle Grade Clear',
      purchase_intent: 'Immediate purchase upon sample approval',
      commercial_requirements: 'Payment terms net 30, FOB Cleveland',
      customer_objections: 'Concerned about contamination levels',
      next_steps: 'Send 5kg sample to quality lab',
      callback_time: 'Friday 10am',
    },
  });

  assert.strictEqual(mapped.contactName, 'David Miller');
  assert.strictEqual(mapped.companyName, 'Miller Plastics Corp');
  assert.strictEqual(mapped.emailAddress, 'dmiller@millerplastics.com');
  assert.strictEqual(mapped.directPhoneNumber, '+14155551234');
  assert.strictEqual(mapped.materialInterest, 'PET Flakes');
  assert.strictEqual(mapped.estimatedVolume, '100 metric tons/month');
  assert.strictEqual(mapped.materialGrade, 'Bottle Grade Clear');
  assert.strictEqual(mapped.purchaseIntent, 'Immediate purchase upon sample approval');
  assert.strictEqual(mapped.commercialRequirements, 'Payment terms net 30, FOB Cleveland');
  assert.strictEqual(mapped.customerObjections, 'Concerned about contamination levels');
  assert.strictEqual(mapped.nextSteps, 'Send 5kg sample to quality lab');
  assert.strictEqual(mapped.callbackTime, 'Friday 10am');
});

// -----------------------------------------------------------------------------
// 3. UI STATUS LABELS & TONES
// -----------------------------------------------------------------------------
console.log('\n3. UI Status Labels & Badge Tones (lib/ui/status.ts):');

const { callOutcomeLabel, callOutcomeTone } = require('../lib/ui/status');

it('Scenario 12: Maps all 12 canonical outcomes to clear labels and badge tones', () => {
  assert.strictEqual(callOutcomeLabel('QUALIFIED'), 'Qualified');
  assert.strictEqual(callOutcomeTone('QUALIFIED'), 'success');

  assert.strictEqual(callOutcomeLabel('NEEDS_REVIEW'), 'Needs Review');
  assert.strictEqual(callOutcomeTone('NEEDS_REVIEW'), 'warning');

  assert.strictEqual(callOutcomeLabel('CALLBACK_REQUESTED'), 'Callback Requested');
  assert.strictEqual(callOutcomeTone('CALLBACK_REQUESTED'), 'warning');

  assert.strictEqual(callOutcomeLabel('FOLLOW_UP_REQUIRED'), 'Follow-up Required');
  assert.strictEqual(callOutcomeTone('FOLLOW_UP_REQUIRED'), 'info');

  assert.strictEqual(callOutcomeLabel('INTERESTED'), 'Interested');
  assert.strictEqual(callOutcomeTone('INTERESTED'), 'info');

  assert.strictEqual(callOutcomeLabel('NOT_INTERESTED'), 'Not Interested');
  assert.strictEqual(callOutcomeTone('NOT_INTERESTED'), 'neutral');

  assert.strictEqual(callOutcomeLabel('NOT_QUALIFIED'), 'Not Qualified');
  assert.strictEqual(callOutcomeTone('NOT_QUALIFIED'), 'neutral');

  assert.strictEqual(callOutcomeLabel('VOICEMAIL'), 'Voicemail');
  assert.strictEqual(callOutcomeTone('VOICEMAIL'), 'neutral');

  assert.strictEqual(callOutcomeLabel('NO_ANSWER'), 'No Answer');
  assert.strictEqual(callOutcomeTone('NO_ANSWER'), 'neutral');

  assert.strictEqual(callOutcomeLabel('BUSY'), 'Busy');
  assert.strictEqual(callOutcomeTone('BUSY'), 'neutral');

  assert.strictEqual(callOutcomeLabel('FAILED'), 'Failed');
  assert.strictEqual(callOutcomeTone('FAILED'), 'error');

  assert.strictEqual(callOutcomeLabel('DO_NOT_CALL'), 'Do Not Call');
  assert.strictEqual(callOutcomeTone('DO_NOT_CALL'), 'error');
});

// -----------------------------------------------------------------------------
// 4. IN-MEMORY SIMULATED REPOSITORY & WEBHOOK ORCHESTRATION
// -----------------------------------------------------------------------------
console.log('\n4. Webhook Ingestion, Idempotency & Out-of-Order Handling:');

// In-memory Supabase mock simulating public.call_sessions, call_outcomes, call_transcripts, audit_logs, webhook_events, leads
class MockSupabaseClient {
  constructor() {
    this.tables = {
      call_sessions: [],
      call_outcomes: [],
      call_transcripts: [],
      call_recordings: [],
      audit_logs: [],
      webhook_events: [],
      leads: [],
      campaign_enrollments: [],
      campaigns: [],
    };
  }

  from(tableName) {
    const table = this.tables[tableName] || [];
    const client = this;

    return {
      select(columns, options) {
        let rows = [...table];
        return {
          eq(col, val) {
            rows = rows.filter((r) => r[col] === val);
            return this;
          },
          in(col, vals) {
            rows = rows.filter((r) => vals.includes(r[col]));
            return this;
          },
          order(col, opts) {
            rows.sort((a, b) => {
              if (opts?.ascending) return (a[col] > b[col] ? 1 : -1);
              return (a[col] < b[col] ? 1 : -1);
            });
            return this;
          },
          limit(n) {
            rows = rows.slice(0, n);
            return this;
          },
          range(start, end) {
            rows = rows.slice(start, end + 1);
            return this;
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
      },

      insert(payload) {
        const item = {
          id: payload.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
          ...payload,
        };
        table.push(item);

        return {
          select() {
            return {
              async single() {
                return { data: item, error: null };
              },
            };
          },
          then(resolve) {
            resolve({ data: item, error: null });
          },
        };
      },

      update(payload) {
        let targetFilter = {};
        return {
          eq(col, val) {
            targetFilter[col] = val;
            return this;
          },
          select() {
            return {
              async single() {
                const match = table.find((r) => Object.entries(targetFilter).every(([k, v]) => r[k] === v));
                if (match) {
                  Object.assign(match, payload);
                  return { data: match, error: null };
                }
                return { data: null, error: new Error('Update match not found') };
              },
            };
          },
          then(resolve) {
            const matches = table.filter((r) => Object.entries(targetFilter).every(([k, v]) => r[k] === v));
            matches.forEach((m) => Object.assign(m, payload));
            resolve({ data: matches, error: null });
          },
        };
      },
    };
  }
}

const { CallsRepository } = require('../repositories/calls.repository');
const { RetellWebhookService } = require('../services/retell/RetellWebhookService');

await itAsync('Scenario 13 & 14 & 15: CallsRepository saves outcomes, hydrates lead calls with transcripts & analysis', async () => {
  const mockDb = new MockSupabaseClient();
  const repo = new CallsRepository(mockDb);

  const orgId = 'org_test_123';
  const leadId = 'lead_test_456';

  // Create call session
  const callSession = await repo.create({
    organization_id: orgId,
    lead_id: leadId,
    retell_call_id: 'call_retell_999',
    direction: 'outbound',
    status: 'in_progress',
  });

  // Record outcome
  await repo.recordOutcome({
    call_session_id: callSession.id,
    organization_id: orgId,
    disposition: 'NEEDS_REVIEW',
    notes: 'Contact info verified; volume pending commercial review.',
  });

  // Save transcripts
  await repo.saveTranscriptSegment({
    organization_id: orgId,
    call_session_id: callSession.id,
    body: 'ai: Hello, this is Alex from RM Dialing.',
  });
  await repo.saveTranscriptSegment({
    organization_id: orgId,
    call_session_id: callSession.id,
    body: 'lead: Hi Alex, this is John.',
  });

  // Log analysis event
  await repo.logEvent({
    organization_id: orgId,
    call_id: callSession.id,
    event_type: 'call_analyzed',
    payload: {
      summary: 'Verified decision maker; commercial volume not stated.',
      call_outcome: 'NEEDS_REVIEW',
      qualification: {
        outcome: 'NEEDS_REVIEW',
        isQualified: false,
        decisionMakerInvolved: true,
        contactName: 'John',
      },
    },
  });

  // Verify listCallsWithDetailsForLead
  const leadCalls = await repo.listCallsWithDetailsForLead(leadId, orgId);
  assert.strictEqual(leadCalls.length, 1);
  assert.strictEqual(leadCalls[0].outcome, 'NEEDS_REVIEW');
  assert.strictEqual(leadCalls[0].retell_call_id, 'call_retell_999');
  assert.ok(leadCalls[0].transcript.includes('Alex from RM Dialing'));
  assert.ok(leadCalls[0].transcript.includes('Hi Alex, this is John'));
  assert.strictEqual(leadCalls[0].analysis.qualification.contactName, 'John');

  // Verify getCallDetails
  const callDetails = await repo.getCallDetails(callSession.id, orgId);
  assert.strictEqual(callDetails.id, callSession.id);
  assert.strictEqual(callDetails.outcome, 'NEEDS_REVIEW');
});

await itAsync('Scenario 16 & 17: Webhook call_ended and call_analyzed flow persists outcomes and updates CRM lead', async () => {
  const mockDb = new MockSupabaseClient();
  const orgId = 'org_live_001';
  const leadId = 'lead_prod_001';

  // Seed CRM lead in mock DB
  mockDb.tables.leads.push({
    id: leadId,
    organization_id: orgId,
    name: 'Initial Prospect',
    title: 'General Manager',
    company: 'Alpha Mfg',
    phone: '+15550001111',
    status: 'NEW',
    notes: '',
  });

  const webhookService = new RetellWebhookService(mockDb);

  const retellCallId = 'call_webhook_flow_1';
  const rmCallId = 'session_rm_flow_1';

  // Pre-seed call session
  mockDb.tables.call_sessions.push({
    id: rmCallId,
    organization_id: orgId,
    lead_id: leadId,
    retell_call_id: retellCallId,
    status: 'in_progress',
    direction: 'outbound',
    started_at: new Date(Date.now() - 60000).toISOString(),
    created_at: new Date(Date.now() - 60000).toISOString(),
  });

  // Step 1: call_ended arrives (without analysis yet)
  const callEndedResult = await webhookService.processWebhook({
    event: 'call_ended',
    call: {
      call_id: retellCallId,
      call_status: 'ended',
      start_timestamp: Date.now() - 60000,
      end_timestamp: Date.now(),
      duration_ms: 60000,
      disconnection_reason: 'user_hangup',
      transcript_object: [
        { role: 'agent', content: 'Good morning, is this Mark?' },
        { role: 'user', content: 'Yes it is, what can I do for you?' },
      ],
      metadata: {
        organizationId: orgId,
        leadId: leadId,
        rmCallId: rmCallId,
      },
    },
  });

  assert.strictEqual(callEndedResult.success, true);
  const updatedCall = mockDb.tables.call_sessions.find((c) => c.id === rmCallId);
  assert.strictEqual(updatedCall.status, 'completed');
  assert.strictEqual(updatedCall.duration_seconds, 60);

  // Transcript turns saved
  const transcripts = mockDb.tables.call_transcripts.filter((t) => t.call_session_id === rmCallId);
  assert.strictEqual(transcripts.length, 2);

  // No premature qualification outcome assigned while conversation took place
  const outcomePreAnalysis = mockDb.tables.call_outcomes.find((o) => o.call_session_id === rmCallId);
  assert.strictEqual(outcomePreAnalysis, undefined, 'Must not assign arbitrary qualification outcome before analysis');

  // Step 2: call_analyzed arrives with full qualification
  const callAnalyzedResult = await webhookService.processWebhook({
    event: 'call_analyzed',
    call: {
      call_id: retellCallId,
      call_status: 'ended',
      call_analysis: {
        call_summary: 'Spoke with Mark Davis. Confirmed monthly volume of 25 tons PP pellets.',
        call_successful: true,
        user_sentiment: 'Positive',
        custom_analysis_data: {
          decision_maker_identified: true,
          contact_name: 'Mark Davis',
          job_title: 'Plant Manager',
          company_name: 'Davis Plastics',
          email: 'mark@davisplastics.com',
          material_interest: 'PP Pellets',
          volume: '25 tons/month',
          material_grade: 'Extrusion Grade',
        },
      },
      metadata: {
        organizationId: orgId,
        leadId: leadId,
        rmCallId: rmCallId,
      },
    },
  });

  assert.strictEqual(callAnalyzedResult.success, true);

  // Outcome saved in call_outcomes
  const outcomePostAnalysis = mockDb.tables.call_outcomes.find((o) => o.call_session_id === rmCallId);
  assert.ok(outcomePostAnalysis);
  assert.strictEqual(outcomePostAnalysis.disposition, 'QUALIFIED');

  // Lead updated in CRM
  const lead = mockDb.tables.leads.find((l) => l.id === leadId);
  assert.strictEqual(lead.status, 'TECHNICAL_EVALUATION');
  assert.strictEqual(lead.name, 'Mark Davis');
  assert.strictEqual(lead.title, 'Plant Manager');
  assert.strictEqual(lead.company, 'Davis Plastics');
  assert.strictEqual(lead.email, 'mark@davisplastics.com');
  assert.ok(lead.notes.includes('[Call QUALIFIED]'));
});

await itAsync('Scenario 18: Out-of-order webhook delivery (call_analyzed arrives before call_ended) preserves analysis', async () => {
  const mockDb = new MockSupabaseClient();
  const orgId = 'org_ooo_001';
  const leadId = 'lead_ooo_001';
  const rmCallId = 'session_ooo_1';
  const retellCallId = 'call_ooo_1';

  mockDb.tables.leads.push({
    id: leadId,
    organization_id: orgId,
    name: 'Prospect OOO',
    status: 'NEW',
  });

  mockDb.tables.call_sessions.push({
    id: rmCallId,
    organization_id: orgId,
    lead_id: leadId,
    retell_call_id: retellCallId,
    status: 'in_progress',
  });

  const webhookService = new RetellWebhookService(mockDb);

  // 1. call_analyzed arrives FIRST
  const analyzedRes = await webhookService.processWebhook({
    event: 'call_analyzed',
    call: {
      call_id: retellCallId,
      call_status: 'ended',
      call_analysis: {
        call_summary: 'Decision maker captured, needs review on volume.',
        call_successful: true,
        user_sentiment: 'Positive',
        custom_analysis_data: {
          decision_maker_identified: true,
          contact_name: 'Alice Cooper',
          email: 'alice@cooper.com',
        },
      },
      metadata: {
        organizationId: orgId,
        leadId: leadId,
        rmCallId: rmCallId,
      },
    },
  });

  assert.strictEqual(analyzedRes.success, true);
  const outcomeAfterAnalyzed = mockDb.tables.call_outcomes.find((o) => o.call_session_id === rmCallId);
  assert.strictEqual(outcomeAfterAnalyzed.disposition, 'NEEDS_REVIEW');

  // 2. call_ended arrives SECOND
  const endedRes = await webhookService.processWebhook({
    event: 'call_ended',
    call: {
      call_id: retellCallId,
      call_status: 'ended',
      duration_ms: 45000,
      disconnection_reason: 'user_hangup',
      metadata: {
        organizationId: orgId,
        leadId: leadId,
        rmCallId: rmCallId,
      },
    },
  });

  assert.strictEqual(endedRes.success, true);

  // Verify call_outcomes disposition is NOT overwritten or reset
  const outcomeFinal = mockDb.tables.call_outcomes.find((o) => o.call_session_id === rmCallId);
  assert.strictEqual(outcomeFinal.disposition, 'NEEDS_REVIEW', 'Outcome from analysis must be preserved when call_ended arrives later');
});

await itAsync('Scenario 19: Duplicate webhook delivery is caught cleanly by idempotency', async () => {
  const mockDb = new MockSupabaseClient();
  const webhookService = new RetellWebhookService(mockDb);
  const retellCallId = 'call_dup_123';

  const payload = {
    event: 'call_started',
    call: {
      call_id: retellCallId,
      call_status: 'ongoing',
      start_timestamp: 1700000000000,
      metadata: { organizationId: 'org_dup', rmCallId: 'session_dup' },
    },
  };

  const res1 = await webhookService.processWebhook(payload);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.isDuplicate, undefined);

  // Deliver duplicate
  const res2 = await webhookService.processWebhook(payload);
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.isDuplicate, true, 'Second delivery must be recognized as duplicate');
});

await itAsync('Scenario 20: Disconnection-only events (voicemail, no answer, busy, failed) record proper non-connected outcomes', async () => {
  const mockDb = new MockSupabaseClient();
  const webhookService = new RetellWebhookService(mockDb);

  const testCases = [
    { reason: 'voicemail_reached', expected: 'VOICEMAIL' },
    { reason: 'dial_no_answer', expected: 'NO_ANSWER' },
    { reason: 'dial_busy', expected: 'BUSY' },
    { reason: 'dial_failed', expected: 'FAILED' },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const { reason, expected } = testCases[i];
    const callId = `call_disc_${i}`;
    const rmCallId = `session_disc_${i}`;

    mockDb.tables.call_sessions.push({
      id: rmCallId,
      organization_id: 'org_disc',
      retell_call_id: callId,
      status: 'in_progress',
    });

    await webhookService.processWebhook({
      event: 'call_ended',
      call: {
        call_id: callId,
        call_status: 'ended',
        duration_ms: 12000,
        disconnection_reason: reason,
        metadata: { organizationId: 'org_disc', rmCallId: rmCallId },
      },
    });

    const outcome = mockDb.tables.call_outcomes.find((o) => o.call_session_id === rmCallId);
    assert.ok(outcome, `Outcome should be recorded for ${reason}`);
    assert.strictEqual(outcome.disposition, expected);
  }
});

  console.log('\n========================================================================');
  console.log(`ALL TEST SCENARIOS PASSED (${testsPassed} / ${testsRun} TESTS VERIFIED)`);
  console.log('========================================================================\n');
}

runAll().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
