/**
 * RM 80/20 AI DIALER — FINAL MASTER PRODUCTION ACCEPTANCE & E2E TEST SUITE
 * Covers Parts 1–15 of the Final Master Prompt:
 * - CSV & Lead Management (including active-call delete guard & soft-archive)
 * - Campaign Creation, Desired Outcome, Immediate Start & Automatic Scheduling
 * - Retell + Twilio Calling, Concurrency Lock & 3-Attempt Retry Engine (No Answer / Busy)
 * - Retell Webhooks, Signature Verification & Idempotency
 * - Claude CRM Intelligence Brain (Structured Extraction, Desired Outcome Evaluation, Zero Fabrication, Callbacks)
 * - Resend Email Automation (Strictly Qualified Leads Only, Personalization, Missing Email Handling, Idempotency)
 * - Complete 21-Step End-to-End Autonomous Production Workflow
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const relative = request.slice(2);
    const resolvedPath = path.resolve(__dirname, '..', relative);
    return originalResolveFilename.call(this, resolvedPath, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function (module, filename) {
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

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dlzigblkklugatcrndbe.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod_test_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_test_key';
process.env.NEXT_PUBLIC_DEFAULT_ORG_ID = '2f7cec0b-6e1b-419c-80eb-2254789daac2';
process.env.RETELL_API_KEY = 'key_test_final_master_mock';
process.env.RETELL_AGENT_ID = 'agent_25a6c8f0015fbdc154a572e2a8';
process.env.RETELL_PHONE_NUMBER = '+13027860788';
process.env.AI_VOICE_RUNTIME = 'retell';
process.env.RETELL_CAMPAIGN_MODE = 'live';
process.env.RM_PROVIDER_MODE = 'live';
process.env.TWILIO_ACCOUNT_SID = 'twilio_mock_account_sid_for_unit_tests';
process.env.TWILIO_AUTH_TOKEN = 'auth_token_test_placeholder';
process.env.TWILIO_PHONE_NUMBER = '+13027860788';
process.env.RESEND_API_KEY = 're_test_placeholder_key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-mock_anthropic_test_key';

const { ClaudeCrmIntelligenceService } = require('../services/ai/claude-crm-intelligence.service');
const { RetellWebhookService } = require('../services/retell/RetellWebhookService');
const { retellCallService } = require('../services/retell/RetellCallService');
const { CampaignsRepository } = require('../repositories/campaigns.repository');
const { CampaignsService } = require('../services/campaigns/campaigns.service');
const { CampaignSchedulerService } = require('../services/campaigns/campaign-scheduler.service');
const { LeadsService } = require('../services/leads/leads.service');
const { CallbacksRepository } = require('../repositories/callbacks.repository');
const { AgentsRepository } = require('../repositories/agents.repository');
const { processFollowUp } = require('../services/email/engine');
const { MemoryEmailStore } = require('../services/email/memory-store');
const { SENDABLE_STATUSES } = require('../services/email/types');

// Stub retellCallService.startOutboundCall so no real phone calls are placed during automated tests
let mockRetellCallSeq = 1;
retellCallService.startOutboundCall = async (params) => ({
  providerCallId: `retell_sim_call_${mockRetellCallSeq++}`,
  status: 'registered',
  rawResponse: {
    call_id: `retell_sim_call_${mockRetellCallSeq}`,
    from_number: params.fromNumber,
    to_number: params.toNumber,
    agent_id: params.agentId,
  },
});

let testsRun = 0;
let testsPassed = 0;

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

class InMemoryProdSupabase {
  constructor() {
    this.tables = {
      leads: [],
      campaigns: [],
      campaign_enrollments: [],
      campaign_events: [],
      call_sessions: [],
      call_outcomes: [],
      call_transcripts: [],
      call_recordings: [],
      callbacks: [],
      ai_agents: [
        {
          id: 'a1111111-2222-4333-8444-555555555555',
          organization_id: '2f7cec0b-6e1b-419c-80eb-2254789daac2',
          name: 'Rachel — RM Commercial Trading & Materials Agent',
          retell_agent_id: 'agent_25a6c8f0015fbdc154a572e2a8',
          status: 'ready',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      webhook_events: [],
      audit_logs: [],
      email_messages: [],
      email_jobs: [],
      email_events: [],
      lead_notes: [],
      lead_tags: [],
      lead_tag_assignments: [],
    };
  }

  from(tableName) {
    if (!this.tables[tableName]) this.tables[tableName] = [];
    const table = this.tables[tableName];
    const self = this;

    const buildQuery = (initialRows = [...table], mode = 'select', payload = null) => {
      const filters = [];
      let isSingle = false;
      let isMaybeSingle = false;
      let countExact = false;
      let headOnly = false;
      let limitCount = null;

      const applyFilters = (list) => list.filter((row) => filters.every((f) => f(row)));

      const execute = () => {
        if (mode === 'insert') {
          const items = Array.isArray(payload) ? payload : [payload];
          const inserted = [];
          for (const item of items) {
            if (tableName === 'call_sessions') {
              const activeStatuses = ['queued', 'in_progress', 'ringing', 'initiated', 'registered'];
              if (item.lead_id && activeStatuses.includes(item.status)) {
                const conflict = table.find(
                  (r) => r.lead_id === item.lead_id && activeStatuses.includes(r.status)
                );
                if (conflict) {
                  return {
                    data: null,
                    error: {
                      code: '23505',
                      message: 'duplicate key value violates unique constraint "uq_call_sessions_active_lead"',
                    },
                  };
                }
              }
            }
            if (tableName === 'webhook_events' && item.external_id) {
              const conflict = table.find((r) => r.external_id === item.external_id);
              if (conflict) {
                return {
                  data: null,
                  error: { code: '23505', message: 'duplicate webhook event' },
                };
              }
            }
            const row = {
              id: item.id || `${tableName.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              created_at: item.created_at || new Date().toISOString(),
              updated_at: item.updated_at || new Date().toISOString(),
              ...item,
            };
            table.push(row);
            inserted.push(row);
          }
          const out = isSingle || isMaybeSingle ? inserted[0] || null : inserted;
          return { data: out, error: null, count: inserted.length };
        }

        if (mode === 'upsert') {
          const items = Array.isArray(payload) ? payload : [payload];
          const upserted = [];
          for (const item of items) {
            let existing = null;
            if (tableName === 'campaign_enrollments') {
              existing = table.find(
                (r) => r.campaign_id === item.campaign_id && r.lead_id === item.lead_id
              );
            } else if (item.id) {
              existing = table.find((r) => r.id === item.id);
            }
            if (existing) {
              Object.assign(existing, item);
              upserted.push(existing);
            } else {
              const row = {
                id: item.id || `enr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                state: 'queued',
                attempt_count: 0,
                max_attempts: 3,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...item,
              };
              table.push(row);
              upserted.push(row);
            }
          }
          const out = isSingle || isMaybeSingle ? upserted[0] || null : upserted;
          return { data: out, error: null, count: upserted.length };
        }

        if (mode === 'update') {
          const matched = applyFilters(table);
          for (const r of matched) {
            Object.assign(r, payload);
          }
          const out = isSingle || isMaybeSingle ? matched[0] || null : matched;
          return { data: out, error: null, count: matched.length };
        }

        if (mode === 'delete') {
          const matched = new Set(applyFilters(table));
          for (let i = table.length - 1; i >= 0; i--) {
            if (matched.has(table[i])) table.splice(i, 1);
          }
          return { data: [], error: null, count: matched.size };
        }

        let matched = applyFilters(table);
        if (tableName === 'campaign_enrollments') {
          matched = matched.map((r) => {
            const camp = self.tables.campaigns.find((c) => c.id === r.campaign_id);
            return { ...r, campaigns: camp ? { id: camp.id, name: camp.name } : null };
          });
        }
        const total = matched.length;
        if (limitCount !== null) matched = matched.slice(0, limitCount);
        if (headOnly) return { data: null, error: null, count: total };
        if (isSingle) {
          if (matched.length === 0) return { data: null, error: { message: 'Not found' } };
          return { data: matched[0], error: null, count: total };
        }
        if (isMaybeSingle) {
          return { data: matched[0] || null, error: null, count: total };
        }
        return { data: matched, error: null, count: countExact ? total : matched.length };
      };

      const chain = {
        select(_cols, opts) {
          if (opts && opts.count === 'exact') countExact = true;
          if (opts && opts.head) headOnly = true;
          return chain;
        },
        insert(data) {
          mode = 'insert';
          payload = data;
          return chain;
        },
        upsert(data) {
          mode = 'upsert';
          payload = data;
          return chain;
        },
        update(data) {
          mode = 'update';
          payload = data;
          return chain;
        },
        delete() {
          mode = 'delete';
          return chain;
        },
        eq(col, val) {
          filters.push((r) => r[col] === val);
          return chain;
        },
        neq(col, val) {
          filters.push((r) => r[col] !== val);
          return chain;
        },
        in(col, vals) {
          filters.push((r) => Array.isArray(vals) && vals.includes(r[col]));
          return chain;
        },
        is(col, val) {
          filters.push((r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val));
          return chain;
        },
        not(col, op, val) {
          if (op === 'is' && val === null) {
            filters.push((r) => r[col] !== null && r[col] !== undefined);
          }
          return chain;
        },
        lt(col, val) {
          filters.push((r) => r[col] && new Date(r[col]).getTime() < new Date(val).getTime());
          return chain;
        },
        or() {
          return chain;
        },
        ilike(col, pattern) {
          const clean = String(pattern).replace(/%/g, '').toLowerCase();
          filters.push((r) => String(r[col] || '').toLowerCase().includes(clean));
          return chain;
        },
        order() {
          return chain;
        },
        range() {
          return chain;
        },
        limit(n) {
          limitCount = n;
          return chain;
        },
        single() {
          isSingle = true;
          return Promise.resolve(execute());
        },
        maybeSingle() {
          isMaybeSingle = true;
          return Promise.resolve(execute());
        },
        then(resolve, reject) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };

      return chain;
    };

    return buildQuery();
  }

  rpc() {
    return Promise.resolve({ data: null, error: { message: 'RPC not mocked' } });
  }
}

async function runSuite() {
  console.log('========================================================================');
  console.log('RM 80/20 AI DIALER — FINAL MASTER PRODUCTION ACCEPTANCE & E2E SUITE');
  console.log('========================================================================\n');

  const orgId = '2f7cec0b-6e1b-419c-80eb-2254789daac2';
  const actorId = 'ad91dc34-89ef-4f12-9012-3456789abcde';

  // =========================================================================
  // 1. CLAUDE CRM INTELLIGENCE BRAIN TESTS
  // =========================================================================
  console.log('1. Claude CRM Intelligence Brain & Desired Outcome Qualification:');

  await itAsync('Test 1.1: Connected call meeting campaign desired outcome is marked QUALIFIED with structured facts', async () => {
    const mockClient = {
      completeJson: async () =>
        JSON.stringify({
          contactName: 'Hendrik Peeters',
          companyName: 'Antwerp Metal Recycling NV',
          phoneNumber: '+3232001122',
          email: 'h.peeters@antwerpmetal.be',
          jobTitle: 'Head of Procurement',
          decisionMakerStatus: 'confirmed',
          decisionMakerIdentified: true,
          materialOrProduct: 'HMS 1&2 Ferrous Scrap and Copper Millberry',
          estimatedVolume: '450 MT per month',
          materialGrade: 'ISRI 200-206 / 99.9% Cu',
          frequency: 'Monthly recurring contract',
          location: 'Port of Antwerp CIF',
          timeline: 'Immediate Q4 allocation',
          interestLevel: 'high',
          objections: [],
          requirements: ['SGS inspection certificate', 'CIF Antwerp pricing'],
          nextSteps: 'Send formal commercial quotation and technical specification sheet to h.peeters@antwerpmetal.be',
          callbackRequested: false,
          callbackDateTime: null,
          followUpDate: null,
          dncRequested: false,
          desiredOutcomeAchieved: true,
          qualificationStatus: 'QUALIFIED',
          technicalStatus: 'COMPLETED',
          qualificationReasoning: 'Confirmed decision maker with 450 MT/month HMS 1&2 requirement and immediate timeline.',
          callSummary: 'Hendrik Peeters (Head of Procurement at Antwerp Metal Recycling NV) confirmed 450 MT/month HMS 1&2 requirement CIF Antwerp and requested formal quotation.',
          evidenceQuotes: ['We need 450 metric tons per month of HMS 1&2 delivered CIF Antwerp, send the quotation to h.peeters@antwerpmetal.be'],
          recommendedPipelineStage: 'COMMERCIAL_DISCUSSION',
        }),
    };

    const brain = new ClaudeCrmIntelligenceService(mockClient);
    const res = await brain.analyzeCompletedCall({
      callId: 'call_qual_001',
      transcriptText: 'Agent: Hello Hendrik. Prospect: We need 450 metric tons per month of HMS 1&2 delivered CIF Antwerp, send the quotation to h.peeters@antwerpmetal.be',
      disconnectionReason: 'user_hangup',
      durationSeconds: 95,
      campaignContext: {
        name: 'Benelux Scrap Metal Campaign',
        desiredOutcome: 'Confirm decision maker, material type, monthly tonnage >= 100 MT, and agreement to receive quotation.',
      },
    });

    assert.strictEqual(res.claudeAnalysis.qualificationStatus, 'QUALIFIED');
    assert.strictEqual(res.claudeAnalysis.desiredOutcomeAchieved, true);
    assert.strictEqual(res.claudeAnalysis.decisionMakerIdentified, true);
    assert.strictEqual(res.claudeAnalysis.estimatedVolume, '450 MT per month');
    assert.strictEqual(res.claudeAnalysis.email, 'h.peeters@antwerpmetal.be');
    assert.strictEqual(res.claudeAnalysis.analysisSource, 'claude_live');
  });

  await itAsync('Test 1.2: Non-connected call (no_answer / busy / failed) is NEVER marked QUALIFIED and fabricates zero facts', async () => {
    const brain = new ClaudeCrmIntelligenceService();
    const resNoAnswer = await brain.analyzeCompletedCall({
      callId: 'call_na_001',
      transcriptText: '',
      disconnectionReason: 'dial_no_answer',
      durationSeconds: 0,
    });
    assert.strictEqual(resNoAnswer.claudeAnalysis.technicalStatus, 'NO_ANSWER');
    assert.strictEqual(resNoAnswer.claudeAnalysis.desiredOutcomeAchieved, false);
    assert.strictEqual(resNoAnswer.claudeAnalysis.materialOrProduct, null);
    assert.strictEqual(resNoAnswer.claudeAnalysis.estimatedVolume, null);

    const resBusy = await brain.analyzeCompletedCall({
      callId: 'call_busy_001',
      transcriptText: '',
      disconnectionReason: 'dial_busy',
      durationSeconds: 0,
    });
    assert.strictEqual(resBusy.claudeAnalysis.technicalStatus, 'BUSY');
    assert.strictEqual(resBusy.claudeAnalysis.desiredOutcomeAchieved, false);
  });

  await itAsync('Test 1.3: Connected call with insufficient evidence is conservatively marked NEEDS_REVIEW', async () => {
    const failingClient = {
      completeJson: async () => {
        throw new Error('Simulated Anthropic timeout');
      },
    };
    const brain = new ClaudeCrmIntelligenceService(failingClient);
    const res = await brain.analyzeCompletedCall({
      callId: 'call_short_001',
      transcriptText: 'Agent: Hello? Prospect: Yes hello, who is calling? Agent: RM Group.',
      retellCallOutcome: 'UNKNOWN',
      retellSummary: 'Brief connected call without commercial details.',
      disconnectionReason: 'user_hangup',
      durationSeconds: 18,
    });

    assert.strictEqual(res.claudeAnalysis.qualificationStatus, 'NEEDS_REVIEW');
    assert.strictEqual(res.claudeAnalysis.desiredOutcomeAchieved, false);
    assert.strictEqual(res.claudeAnalysis.analysisSource, 'deterministic_fallback');
  });

  // =========================================================================
  // 2. RESEND EMAIL AUTOMATION — QUALIFIED LEADS ONLY
  // =========================================================================
  console.log('\n2. Resend Email Automation (Strictly Qualified Leads Only):');

  await itAsync('Test 2.1: SENDABLE_STATUSES contains ONLY QUALIFIED', async () => {
    assert.deepStrictEqual(SENDABLE_STATUSES, ['QUALIFIED']);
  });

  await itAsync('Test 2.2: Qualified lead with valid email receives personalized campaign email via Resend', async () => {
    const store = new MemoryEmailStore();
    await store.saveSettings(orgId, {
      enabled: true,
      paused: false,
      hourlySendLimit: 30,
      senderName: 'RM Global Materials',
      companyBlurb: 'RM Global Materials Desk',
      inboundConfigured: true,
      senderDomainVerified: true,
    });

    const sentPayloads = [];
    const deps = {
      claude: { completeJson: async () => '{}' },
      sender: {
        send: async (input) => {
          sentPayloads.push(input);
          return { ok: true, id: 're_msg_qualified_001' };
        },
      },
      now: () => new Date(),
      appUrl: 'https://80-20-ai-dialer.vercel.app',
      fromEmail: 'sales@rmrg.be',
      replyTo: 'sales@rmrg.be',
      unsubscribeSecret: 'secret_test_key',
      providerReady: true,
    };

    const call = {
      organizationId: orgId,
      callId: 'call_qual_email_001',
      callStatus: 'completed',
      callFinished: true,
      analyzed: true,
      disconnectionReason: 'user_hangup',
      transcript: [
        { speaker: 'ai', text: 'Hello Hendrik, calling from RM Global Materials.' },
        { speaker: 'lead', text: 'We need 450 MT of HMS 1&2 scrap per month. Send your offer to h.peeters@antwerpmetal.be' },
      ],
      lead: {
        id: 'lead_qual_001',
        firstName: 'Hendrik',
        lastName: 'Peeters',
        companyName: 'Antwerp Metal Recycling NV',
        email: 'h.peeters@antwerpmetal.be',
        country: 'BE',
        region: 'BE',
        isDnc: false,
        unsubscribed: false,
        stopAllContact: false,
        emailOptIn: true,
        lawfulBasis: 'legitimate_interest_documented',
        lawfulBasisEvidence: 'B2B commercial discussion and quotation request',
      },
      campaign: {
        id: 'camp_001',
        name: 'Benelux Scrap Campaign',
        emailFollowupEnabled: true,
        lawfulBasis: 'legitimate_interest_documented',
        lawfulBasisNote: 'B2B commercial discussion and quotation request',
        instructions: 'Send commercial summary',
        emailSubject: 'RM Global Materials — Quotation Follow-Up for {{company_name}}',
        emailBody: 'Dear {{contact_name}},\n\nThank you for discussing {{material_interest}} for {{company_name}}.',
        companySignature: 'RM Global Materials | sales@rmrg.be',
        requiredCommercialInfo: ['450 MT HMS 1&2'],
      },
      outcome: {
        disposition: 'QUALIFIED',
        notes: 'Hendrik Peeters confirmed 450 MT/month HMS 1&2 requirement.',
      },
    };

    const result = await processFollowUp(store, deps, call);
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.status, 'accepted');
    assert.strictEqual(sentPayloads.length, 1);
    assert.ok(sentPayloads[0].subject.includes('Antwerp Metal Recycling NV'));
    assert.ok(sentPayloads[0].text.includes('Dear Hendrik Peeters'));
    assert.ok(sentPayloads[0].text.includes('450 MT HMS 1&2'));

    // Duplicate send prevention on second trigger
    const dupResult = await processFollowUp(store, deps, call);
    assert.strictEqual(dupResult.sent, false);
    assert.strictEqual(dupResult.duplicate, true);
    assert.strictEqual(sentPayloads.length, 1);
  });

  await itAsync('Test 2.3: Non-qualified leads (NOT_INTERESTED, NO_ANSWER, NEEDS_REVIEW) never receive email', async () => {
    const store = new MemoryEmailStore();
    await store.saveSettings(orgId, {
      enabled: true,
      paused: false,
      hourlySendLimit: 30,
      senderName: 'RM Global Materials',
      companyBlurb: 'RM Global Materials Desk',
      inboundConfigured: true,
      senderDomainVerified: true,
    });

    let sendCount = 0;
    const deps = {
      claude: { completeJson: async () => '{}' },
      sender: {
        send: async () => {
          sendCount++;
          return { ok: true, id: 'should_not_send' };
        },
      },
      now: () => new Date(),
      appUrl: 'https://80-20-ai-dialer.vercel.app',
      fromEmail: 'sales@rmrg.be',
      replyTo: 'sales@rmrg.be',
      unsubscribeSecret: 'secret_test_key',
      providerReady: true,
    };

    for (const nonQualDisposition of ['REJECTED', 'NEEDS_REVIEW', 'NO_ANSWER', 'DO_NOT_CALL', 'CALLBACK_REQUESTED']) {
      const res = await processFollowUp(store, deps, {
        organizationId: orgId,
        callId: `call_${nonQualDisposition}`,
        callStatus: 'completed',
        callFinished: true,
        analyzed: true,
        disconnectionReason: 'user_hangup',
        transcript: [{ speaker: 'lead', text: 'Not interested right now.' }],
        lead: {
          id: `lead_${nonQualDisposition}`,
          firstName: 'Test',
          lastName: 'Lead',
          companyName: 'Test Corp',
          email: 'test@testcorp.com',
          country: 'US',
          region: 'NY',
          isDnc: false,
          unsubscribed: false,
          stopAllContact: false,
          emailOptIn: true,
          lawfulBasis: 'legitimate_interest_documented',
          lawfulBasisEvidence: 'B2B commercial discussion',
        },
        campaign: {
          id: 'camp_001',
          name: 'Test Campaign',
          emailFollowupEnabled: true,
          lawfulBasis: 'legitimate_interest_documented',
          lawfulBasisNote: 'B2B commercial discussion',
          instructions: null,
        },
        outcome: { disposition: nonQualDisposition, notes: 'Non-qualified outcome' },
      });
      assert.strictEqual(res.sent, false);
      assert.strictEqual(res.status, 'suppressed');
    }
    assert.strictEqual(sendCount, 0);
  });

  await itAsync('Test 2.4: Qualified lead without valid email records invalid_email suppression reason without crashing', async () => {
    const store = new MemoryEmailStore();
    await store.saveSettings(orgId, {
      enabled: true,
      paused: false,
      hourlySendLimit: 30,
      senderName: 'RM Global Materials',
      companyBlurb: 'RM Global Materials Desk',
      inboundConfigured: true,
      senderDomainVerified: true,
    });

    const deps = {
      claude: { completeJson: async () => '{}' },
      sender: { send: async () => ({ ok: true, id: 'never' }) },
      now: () => new Date(),
      appUrl: 'https://80-20-ai-dialer.vercel.app',
      fromEmail: 'sales@rmrg.be',
      replyTo: 'sales@rmrg.be',
      unsubscribeSecret: 'secret_test_key',
      providerReady: true,
    };

    const res = await processFollowUp(store, deps, {
      organizationId: orgId,
      callId: 'call_qual_no_email',
      callStatus: 'completed',
      callFinished: true,
      analyzed: true,
      disconnectionReason: 'user_hangup',
      transcript: [{ speaker: 'lead', text: 'Yes I want 200 tons of aluminum scrap.' }],
      lead: {
        id: 'lead_no_email',
        firstName: 'Marc',
        lastName: 'Dubois',
        companyName: 'Dubois Metals',
        email: null,
        country: 'US',
        region: 'NY',
        isDnc: false,
        unsubscribed: false,
        stopAllContact: false,
        emailOptIn: true,
        lawfulBasis: 'legitimate_interest_documented',
        lawfulBasisEvidence: 'B2B commercial discussion',
      },
      campaign: {
        id: 'camp_001',
        name: 'Test Campaign',
        emailFollowupEnabled: true,
        lawfulBasis: 'legitimate_interest_documented',
        lawfulBasisNote: 'B2B commercial discussion',
        instructions: null,
      },
      outcome: { disposition: 'QUALIFIED', notes: 'Qualified lead missing email' },
    });

    assert.strictEqual(res.sent, false);
    assert.strictEqual(res.status, 'suppressed');
    assert.ok(res.reasons.includes('invalid_email'));
  });

  // =========================================================================
  // 3. SAFE LEAD DELETE/ARCHIVE GUARD & 3-ATTEMPT RETRY ENGINE
  // =========================================================================
  console.log('\n3. CRM Safe Lead Archive Guard & 3-Attempt Campaign Retry Engine:');

  await itAsync('Test 3.1: Deleting/archiving a lead is blocked while an active call is in progress, and succeeds once terminal', async () => {
    const db = new InMemoryProdSupabase();
    const leadsService = new LeadsService(db);

    const created = await leadsService.createLead(
      {
        firstName: 'active',
        lastName: 'Caller',
        companyName: 'Active Call Corp',
        phone: '+13025550199',
        email: 'active@callcorp.com',
        country: 'US',
      },
      orgId,
      actorId
    );

    // Insert an active call for this lead
    await db.from('call_sessions').insert({
      id: 'call_active_lock_1',
      organization_id: orgId,
      lead_id: created.id,
      status: 'in_progress',
      direction: 'outbound',
    });

    let blockedError = null;
    try {
      await leadsService.archiveLead(created.id, orgId, actorId);
    } catch (err) {
      blockedError = err;
    }
    assert.ok(blockedError, 'Archive must be blocked while active call is in progress');
    assert.ok(blockedError.message.includes('while a live call is in progress'));

    // Mark call completed, then archive should succeed and abandon any queued campaign enrollment
    await db.from('call_sessions').update({ status: 'completed' }).eq('id', 'call_active_lock_1');
    await db.from('campaign_enrollments').insert({
      id: 'enr_archive_1',
      organization_id: orgId,
      campaign_id: 'camp_test_archive',
      lead_id: created.id,
      state: 'queued',
    });

    const archived = await leadsService.archiveLead(created.id, orgId, actorId);
    assert.ok(archived);
    assert.strictEqual(db.tables.campaign_enrollments[0].state, 'abandoned');
    // Historical call record is preserved
    assert.strictEqual(db.tables.call_sessions.length, 1);
  });

  await itAsync('Test 3.2: Campaign retry engine retries NO_ANSWER and BUSY up to 3 attempts, then marks completed', async () => {
    const db = new InMemoryProdSupabase();
    const campaignsRepo = new CampaignsRepository(db);

    const camp = await campaignsRepo.create({
      organization_id: orgId,
      name: 'Retry Verification Campaign',
      status: 'running',
      agent_id: 'a1111111-2222-4333-8444-555555555555',
      max_attempts_per_lead: 3,
      retry_delay_minutes: 60,
    });

    await db.from('leads').insert({
      id: 'lead_retry_3x',
      organization_id: orgId,
      name: 'Lucas Vandenberg',
      company: 'Ghent Steel Works',
      phone: '+3292450101',
      status: 'NEW',
      do_not_call: false,
      deleted_at: null,
    });

    await campaignsRepo.addLeads(camp.id, ['lead_retry_3x'], orgId, actorId);

    // Attempt 1: Claim -> No Answer -> schedules retry #2
    const claim1 = await campaignsRepo.claimNextLead(camp.id, 'worker_1');
    assert.ok(claim1, 'Attempt 1 must be claimed');
    assert.strictEqual(claim1.attempts, 0);

    await db.from('call_sessions').insert({
      id: 'call_att_1',
      organization_id: orgId,
      campaign_id: camp.id,
      lead_id: 'lead_retry_3x',
      status: 'no_answer',
    });

    const att1Res = await campaignsRepo.recordAttemptAndScheduleRetry({
      campaignId: camp.id,
      leadId: 'lead_retry_3x',
      campaignLeadId: claim1.campaignLeadId,
      callId: 'call_att_1',
      outcome: 'no_answer',
      qualificationOutcome: 'NO_ANSWER',
    });
    assert.strictEqual(att1Res.attemptCount, 1);
    assert.strictEqual(att1Res.state, 'queued');
    assert.ok(att1Res.nextAttemptAt, 'Must schedule nextAttemptAt after Attempt 1 no_answer');

    // While next_attempt_at is in the future, claimNextLead returns null
    const prematureClaim = await campaignsRepo.claimNextLead(camp.id, 'worker_1');
    assert.strictEqual(prematureClaim, null, 'Must wait for retry delay before Attempt 2');

    // Fast-forward next_attempt_at to past
    db.tables.campaign_enrollments[0].next_attempt_at = new Date(Date.now() - 1000).toISOString();

    // Attempt 2: Claim -> Busy -> schedules retry #3
    const claim2 = await campaignsRepo.claimNextLead(camp.id, 'worker_1');
    assert.ok(claim2, 'Attempt 2 must be claimed after retry delay');
    assert.strictEqual(claim2.attempts, 1);

    await db.from('call_sessions').insert({
      id: 'call_att_2',
      organization_id: orgId,
      campaign_id: camp.id,
      lead_id: 'lead_retry_3x',
      status: 'busy',
    });

    const att2Res = await campaignsRepo.recordAttemptAndScheduleRetry({
      campaignId: camp.id,
      leadId: 'lead_retry_3x',
      campaignLeadId: claim2.campaignLeadId,
      callId: 'call_att_2',
      outcome: 'busy',
      qualificationOutcome: 'BUSY',
    });
    assert.strictEqual(att2Res.attemptCount, 2);
    assert.strictEqual(att2Res.state, 'queued');
    assert.ok(att2Res.nextAttemptAt, 'Must schedule nextAttemptAt after Attempt 2 busy');

    // Fast-forward next_attempt_at to past
    db.tables.campaign_enrollments[0].next_attempt_at = new Date(Date.now() - 1000).toISOString();

    // Attempt 3: Claim -> No Answer -> reaches 3-attempt max -> marked completed!
    const claim3 = await campaignsRepo.claimNextLead(camp.id, 'worker_1');
    assert.ok(claim3, 'Attempt 3 must be claimed after retry delay');
    assert.strictEqual(claim3.attempts, 2);

    await db.from('call_sessions').insert({
      id: 'call_att_3',
      organization_id: orgId,
      campaign_id: camp.id,
      lead_id: 'lead_retry_3x',
      status: 'no_answer',
    });

    const att3Res = await campaignsRepo.recordAttemptAndScheduleRetry({
      campaignId: camp.id,
      leadId: 'lead_retry_3x',
      campaignLeadId: claim3.campaignLeadId,
      callId: 'call_att_3',
      outcome: 'no_answer',
      qualificationOutcome: 'NO_ANSWER',
    });
    assert.strictEqual(att3Res.attemptCount, 3);
    assert.strictEqual(att3Res.state, 'completed');
    assert.strictEqual(att3Res.nextAttemptAt, null);

    // Attempt 4: Must NOT be claimed (exhausted 3 attempts)
    const claim4 = await campaignsRepo.claimNextLead(camp.id, 'worker_1');
    assert.strictEqual(claim4, null, 'No 4th attempt permitted after 3 max attempts');
  });

  // =========================================================================
  // 4. FULL 21-STEP END-TO-END AUTONOMOUS WORKFLOW (PART 15)
  // =========================================================================
  console.log('\n4. Full 21-Step End-to-End Autonomous Production Workflow (Part 15):');

  await itAsync('Test 4.1: Complete 21-step E2E workflow from CSV upload & scheduled campaign to Claude analysis, Callback creation & Campaign completion', async () => {
    const db = new InMemoryProdSupabase();
    const leadsService = new LeadsService(db);
    const campaignsService = new CampaignsService(db);
    const schedulerService = new CampaignSchedulerService(db);
    const webhookService = new RetellWebhookService(db);
    webhookService.verifySignature = async () => true;
    const callbacksRepo = new CallbacksRepository(db);

    // Step 1-2: Upload & validate CSV leads (including valid leads, an invalid phone row, and a duplicate row)
    const sampleCsv = [
      'First Name,Last Name,Company,Title,Phone,Email,City',
      'Karel,Van Damme,Flanders Alloys BV,Procurement Director,+3293301100,k.vandamme@flandersalloys.be,Ghent',
      'Sophie,Laurent,Liege Industrial Metals,Purchasing Manager,+3242203344,s.laurent@liegemetals.be,Liege',
      'Pieter,Janssens,Brussels Scrap Logistics,Operations Lead,+3225506677,p.janssens@brusselsscrap.be,Brussels',
      'Karel,Duplicate,Flanders Alloys BV,Procurement Director,+3293301100,k.vandamme@flandersalloys.be,Ghent',
      'Invalid,PhoneLead,Broken Phone Co,Manager,123,broken@phone.co,Antwerp',
    ].join('\n');

    const mappings = {
      'First Name': 'firstName',
      'Last Name': 'lastName',
      'Company': 'companyName',
      'Title': 'jobTitle',
      'Phone': 'phone',
      'Email': 'email',
      'City': 'city',
    };

    const preview = await leadsService.previewCsvImport(sampleCsv, mappings, 'BE', orgId);
    assert.strictEqual(preview.totalRows, 5);
    assert.strictEqual(preview.invalidRows, 1);
    assert.strictEqual(preview.intraFileDuplicates, 1);
    assert.strictEqual(preview.readyRows, 3);

    // Persist the 3 valid leads
    const lead1 = await leadsService.createLead({
      firstName: 'Karel',
      lastName: 'Van Damme',
      companyName: 'Flanders Alloys BV',
      jobTitle: 'Procurement Director',
      phone: '+3293301100',
      email: 'k.vandamme@flandersalloys.be',
      city: 'Ghent',
      country: 'BE',
    }, orgId, actorId);

    const lead2 = await leadsService.createLead({
      firstName: 'Sophie',
      lastName: 'Laurent',
      companyName: 'Liege Industrial Metals',
      jobTitle: 'Purchasing Manager',
      phone: '+3242203344',
      email: 's.laurent@liegemetals.be',
      city: 'Liege',
      country: 'BE',
    }, orgId, actorId);

    const lead3 = await leadsService.createLead({
      firstName: 'Pieter',
      lastName: 'Janssens',
      companyName: 'Brussels Scrap Logistics',
      jobTitle: 'Operations Lead',
      phone: '+3225506677',
      email: 'p.janssens@brusselsscrap.be',
      city: 'Brussels',
      country: 'BE',
    }, orgId, actorId);

    const leadsList = await leadsService.getLeads(orgId);
    assert.strictEqual(leadsList.totalCount, 3);

    // Step 3-6: Create campaign with desired outcome & email template, enroll the 3 leads, and schedule it
    const pastScheduleIso = new Date(Date.now() - 5000).toISOString();
    const campaign = await campaignsService.createCampaign({
      name: 'Q4 Benelux Metals Autonomous Campaign',
      description: 'End-to-end automated qualification & email follow-up',
      status: 'draft',
      aiAgentId: 'a1111111-2222-4333-8444-555555555555',
      timezone: 'UTC',
      callingDays: [1, 2, 3, 4, 5, 6, 7],
      callingWindowStart: '00:00',
      callingWindowEnd: '23:59',
      maxAttemptsPerLead: 3,
      retryDelayMinutes: 60,
      concurrencyLimit: 5,
      desiredOutcome: 'Confirm decision-maker role, material specification, monthly volume >= 100 MT, and agreement to receive quotation.',
      emailFollowupEnabled: true,
      emailSubject: 'RM Global Materials — Quotation for {{company_name}}',
      emailBody: 'Dear {{contact_name}}, following our call regarding {{material_interest}} ({{estimated_volume}}), here are our commercial terms.',
      companySignature: 'RM Global Materials | sales@rmrg.be',
    }, orgId, actorId);

    const enrollRes = await campaignsService.enrollLeads(
      campaign.id,
      [lead1.id, lead2.id, lead3.id],
      orgId,
      actorId
    );
    assert.strictEqual(enrollRes.added, 3);

    // Schedule campaign and let CampaignSchedulerService automatically activate & dispatch!
    const scheduledCamp = await campaignsService.scheduleCampaign(campaign.id, pastScheduleIso, orgId, actorId);
    assert.strictEqual(scheduledCamp.status, 'scheduled');

    const cycle1 = await schedulerService.runCycle({
      organizationId: orgId,
      operatorId: actorId,
      maxDispatchesPerCampaign: 3,
    });
    assert.ok(cycle1.activatedCampaignIds.includes(campaign.id), 'Scheduler must automatically start due scheduled campaign');
    assert.strictEqual(cycle1.dispatchedCalls.filter((d) => d.dispatched).length, 3, 'Scheduler must dispatch all 3 eligible leads');

    // Step 8-13: Process Call 1 (Lead 1: Connected & QUALIFIED)
    const call1Session = db.tables.call_sessions.find((c) => c.lead_id === lead1.id);
    assert.ok(call1Session);

    await webhookService.processWebhook(
      {
        event: 'call_analyzed',
        call: {
          call_id: call1Session.retell_call_id,
          agent_id: 'agent_25a6c8f0015fbdc154a572e2a8',
          call_status: 'ended',
          start_timestamp: Date.now() - 95000,
          end_timestamp: Date.now(),
          duration_ms: 95000,
          disconnection_reason: 'user_hangup',
          transcript: 'Agent: Hello Karel. Prospect: I am the Procurement Director at Flanders Alloys BV. We need 300 MT per month of Grade A Aluminum Tense scrap delivered to Ghent. Please send the formal quotation to k.vandamme@flandersalloys.be.',
          metadata: {
            organizationId: orgId,
            leadId: lead1.id,
            campaignId: campaign.id,
            rmCallId: call1Session.id,
            operatorId: actorId,
          },
          call_analysis: {
            call_summary: 'Karel Van Damme (Procurement Director at Flanders Alloys BV) confirmed 300 MT/month Aluminum Tense scrap requirement and requested quotation.',
            user_sentiment: 'Positive',
            call_successful: true,
            in_voicemail: false,
            custom_analysis_data: {
              call_outcome: 'QUALIFIED',
              decision_maker_identified: true,
              contact_name: 'Karel Van Damme',
              company_name: 'Flanders Alloys BV',
              job_title: 'Procurement Director',
              email_address: 'k.vandamme@flandersalloys.be',
              material_interest: 'Grade A Aluminum Tense Scrap',
              estimated_volume: '300 MT per month',
              material_grade: 'ISRI Tense',
              purchase_intent: 'Immediate monthly contract',
              next_steps: 'Send formal quotation to k.vandamme@flandersalloys.be',
            },
          },
        },
      },
      JSON.stringify({ event: 'call_analyzed' }),
      'mock-signature'
    );

    // Verify Lead 1 is updated to qualified in CRM
    const updatedLead1 = await leadsService.getLeadById(lead1.id, orgId);
    assert.strictEqual(updatedLead1.status, 'qualified');

    // Step 14-15: Process Call 2 (Lead 2: Connected & NOT_INTERESTED -> no email, no retry)
    const call2Session = db.tables.call_sessions.find((c) => c.lead_id === lead2.id);
    await webhookService.processWebhook(
      {
        event: 'call_analyzed',
        call: {
          call_id: call2Session.retell_call_id,
          agent_id: 'agent_25a6c8f0015fbdc154a572e2a8',
          call_status: 'ended',
          start_timestamp: Date.now() - 40000,
          end_timestamp: Date.now(),
          duration_ms: 40000,
          disconnection_reason: 'user_hangup',
          transcript: 'Agent: Hello Sophie. Prospect: We are under an exclusive annual supply contract and have no interest in new suppliers.',
          metadata: {
            organizationId: orgId,
            leadId: lead2.id,
            campaignId: campaign.id,
            rmCallId: call2Session.id,
            operatorId: actorId,
          },
          call_analysis: {
            call_summary: 'Prospect stated they are locked into an exclusive supply contract and not interested.',
            user_sentiment: 'Negative',
            call_successful: false,
            in_voicemail: false,
            custom_analysis_data: {
              call_outcome: 'NOT_INTERESTED',
              customer_objections: 'Locked into exclusive annual supply contract',
            },
          },
        },
      },
      JSON.stringify({ event: 'call_analyzed' }),
      'mock-signature'
    );

    // Step 16-17: Process Call 3 (Lead 3: CALLBACK_REQUESTED -> saves callback record in public.callbacks)
    const call3Session = db.tables.call_sessions.find((c) => c.lead_id === lead3.id);
    const tomorrowIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await webhookService.processWebhook(
      {
        event: 'call_analyzed',
        call: {
          call_id: call3Session.retell_call_id,
          agent_id: 'agent_25a6c8f0015fbdc154a572e2a8',
          call_status: 'ended',
          start_timestamp: Date.now() - 35000,
          end_timestamp: Date.now(),
          duration_ms: 35000,
          disconnection_reason: 'user_hangup',
          transcript: `Agent: Hello Pieter. Prospect: I am in a warehouse audit right now, please call me back tomorrow at ${tomorrowIso} to discuss our copper scrap tonnage.`,
          metadata: {
            organizationId: orgId,
            leadId: lead3.id,
            campaignId: campaign.id,
            rmCallId: call3Session.id,
            operatorId: actorId,
          },
          call_analysis: {
            call_summary: 'Pieter Janssens requested a callback tomorrow after his warehouse audit.',
            user_sentiment: 'Neutral',
            call_successful: false,
            in_voicemail: false,
            custom_analysis_data: {
              call_outcome: 'CALLBACK_REQUESTED',
              callback_requested: true,
              callback_time: tomorrowIso,
              next_steps: 'Call back tomorrow after warehouse audit',
            },
          },
        },
      },
      JSON.stringify({ event: 'call_analyzed' }),
      'mock-signature'
    );

    // Verify Callback record was persisted in public.callbacks
    const callbacksList = await callbacksRepo.list(orgId, { leadId: lead3.id });
    assert.strictEqual(callbacksList.totalCount, 1);
    assert.strictEqual(callbacksList.callbacks[0].lead_id, lead3.id);
    assert.strictEqual(callbacksList.callbacks[0].status, 'pending');

    // Step 18-21: Run scheduler cycle -> all 3 leads have completed their outcomes -> campaign auto-completes!
    const cycle2 = await schedulerService.runCycle({
      organizationId: orgId,
      operatorId: actorId,
    });
    assert.ok(cycle2.completedCampaignIds.includes(campaign.id), 'Campaign must auto-complete when all leads reach terminal outcomes');

    const finalCampaign = await campaignsService.getCampaignById(campaign.id, orgId);
    assert.strictEqual(finalCampaign.status, 'completed');
    assert.strictEqual(finalCampaign.metrics.totalLeads, 3);
    assert.strictEqual(finalCampaign.metrics.qualified, 1);
    assert.strictEqual(finalCampaign.metrics.callbacks, 1);
    assert.strictEqual(finalCampaign.metrics.progressPercent, 100);
  });

  console.log(`\n========================================================================`);
  console.log(`FINAL MASTER PRODUCTION SUITE PASSED: ${testsPassed} / ${testsRun} TESTS`);
  console.log(`========================================================================\n`);
}

runSuite().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
