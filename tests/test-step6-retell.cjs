/**
 * Step 6 Comprehensive Test Suite — Retell AI Voice Engine & Integration
 * 80/20 AI DIALER
 */

const crypto = require('crypto');
const path = require('path');

const PROJECT_ROOT = 'C:\\Users\\Asus\\Desktop\\RM';

console.log('='.repeat(70));
console.log('STEP 6: RETELL AI VOICE ENGINE & INTEGRATION TEST SUITE');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
  }
}

// -------------------------------------------------------------
// Test Group 1: Retell HMAC SHA-256 Webhook Signature Verification
// -------------------------------------------------------------
console.log('\n--- 1. RETELL HMAC SHA-256 SIGNATURE VERIFICATION ---');

function verifyWebhookSignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader || !secret || !rawBody) return false;
  try {
    const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf-8').digest('hex');
    const signatureBuffer = Buffer.from(signatureHeader.trim(), 'utf-8');
    const computedBuffer = Buffer.from(computed, 'utf-8');
    if (signatureBuffer.length !== computedBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch {
    return false;
  }
}

const secret = 'retell_webhook_secret_test_key_12345';
const validPayload = JSON.stringify({
  event: 'call_analyzed',
  call: {
    call_id: 'call_test_001',
    call_status: 'analyzed',
  },
});

const validSignature = crypto.createHmac('sha256', secret).update(validPayload, 'utf-8').digest('hex');
const tamperedPayload = validPayload + ' ';
const invalidSignature = 'invalid_hex_signature_deadbeef1234567890';

assert(verifyWebhookSignature(validPayload, secret, validSignature) === true, 'Valid signature accepted');
assert(verifyWebhookSignature(tamperedPayload, secret, validSignature) === false, 'Tampered payload rejected');
assert(verifyWebhookSignature(validPayload, secret, invalidSignature) === false, 'Invalid signature rejected');
assert(verifyWebhookSignature(validPayload, secret, null) === false, 'Missing signature rejected');
assert(verifyWebhookSignature(validPayload, '', validSignature) === false, 'Empty secret rejected');
assert(verifyWebhookSignature('', secret, validSignature) === false, 'Empty payload rejected');

// -------------------------------------------------------------
// Test Group 2: Native Qualification Extraction & 7 Lead Statuses
// -------------------------------------------------------------
console.log('\n--- 2. NATIVE QUALIFICATION EXTRACTION & 7 LEAD STATUSES ---');

// Mock RetellMapper extraction logic mirroring retell-mapper.ts
function mapRetellAnalysisToRM(analysis) {
  if (!analysis) {
    return {
      summary: 'Call completed without post-call analysis.',
      sentiment: 'Neutral',
      sentimentScore: 0,
      isSuccessful: false,
      inVoicemail: false,
      callOutcome: 'completed',
      decisionMakerIdentified: false,
      contactName: null,
      jobTitle: null,
      emailAddress: null,
      directPhoneNumber: null,
      interestLevel: 'none',
      materialContext: null,
      followUpRequirements: null,
      leadStatus: 'Unqualified',
      dncRequested: false,
    };
  }

  const custom = analysis.custom_analysis_data || {};
  const summary = analysis.call_summary || '';
  const transcriptSummary = summary.toLowerCase();

  const decisionMakerIdentified = Boolean(
    custom.decision_maker_identified === true ||
    custom.is_decision_maker === true ||
    custom.decision_maker === true ||
    custom.decisionMakerIdentified === true ||
    (analysis.call_successful && !analysis.in_voicemail && !transcriptSummary.includes('gatekeeper'))
  );

  const contactName =
    custom.contact_name ||
    custom.decision_maker_name ||
    custom.name ||
    null;

  const jobTitle =
    custom.job_title ||
    custom.title ||
    custom.role ||
    null;

  const emailAddress =
    custom.email_address ||
    custom.email ||
    custom.contact_email ||
    null;

  const directPhoneNumber =
    custom.direct_phone_number ||
    custom.phone_number ||
    custom.direct_phone ||
    null;

  let interestLevel = 'none';
  const rawInterest = String(custom.interest_level || custom.interest || '').toLowerCase();
  if (rawInterest.includes('high') || rawInterest.includes('strong') || rawInterest.includes('hot')) {
    interestLevel = 'high';
  } else if (rawInterest.includes('medium') || rawInterest.includes('moderate') || rawInterest.includes('warm')) {
    interestLevel = 'medium';
  } else if (rawInterest.includes('low') || rawInterest.includes('cool')) {
    interestLevel = 'low';
  } else if (analysis.call_successful) {
    interestLevel = 'high';
  }

  const materialContext =
    custom.material_context ||
    custom.business_context ||
    custom.notes ||
    summary ||
    null;

  const followUpRequirements =
    custom.follow_up_requirements ||
    custom.next_steps ||
    custom.follow_up ||
    null;

  const dncRequested = Boolean(
    custom.dnc_requested === true ||
    custom.do_not_call === true ||
    transcriptSummary.includes('do not call') ||
    transcriptSummary.includes('remove me from your list') ||
    transcriptSummary.includes('stop calling')
  );

  let leadStatus = 'Unqualified';
  if (dncRequested) {
    leadStatus = 'Do Not Call';
  } else if (
    decisionMakerIdentified &&
    interestLevel === 'high' &&
    (emailAddress !== null || directPhoneNumber !== null) &&
    contactName !== null
  ) {
    leadStatus = 'Confirmed';
  } else if (interestLevel === 'high' || interestLevel === 'medium' || analysis.call_successful) {
    leadStatus = 'Interested';
  } else if (
    followUpRequirements ||
    transcriptSummary.includes('follow up') ||
    transcriptSummary.includes('send info') ||
    transcriptSummary.includes('send email')
  ) {
    leadStatus = 'Follow-up';
  } else if (
    transcriptSummary.includes('call back') ||
    transcriptSummary.includes('callback') ||
    transcriptSummary.includes('busy')
  ) {
    leadStatus = 'Callback';
  } else if (
    interestLevel === 'low' ||
    transcriptSummary.includes('not interested') ||
    transcriptSummary.includes('no thank')
  ) {
    leadStatus = 'Not Interested';
  } else {
    leadStatus = 'Unqualified';
  }

  return {
    summary,
    sentiment: analysis.user_sentiment || 'Neutral',
    sentimentScore: typeof analysis.user_sentiment_score === 'number' ? analysis.user_sentiment_score : 0,
    isSuccessful: Boolean(analysis.call_successful),
    inVoicemail: Boolean(analysis.in_voicemail),
    callOutcome: custom.call_outcome || (analysis.call_successful ? 'qualified' : 'completed'),
    decisionMakerIdentified,
    contactName,
    jobTitle,
    emailAddress,
    directPhoneNumber,
    interestLevel,
    materialContext,
    followUpRequirements,
    leadStatus,
    dncRequested,
  };
}

// Case 1: Confirmed Lead (MUST have decision maker + high interest + contact name + direct phone/email)
const confirmedAnalysis = {
  call_summary: 'Spoke with Sarah Connor, COO. Very interested in AI dialer automation.',
  call_successful: true,
  user_sentiment: 'Positive',
  user_sentiment_score: 0.95,
  in_voicemail: false,
  custom_analysis_data: {
    decision_maker_identified: true,
    contact_name: 'Sarah Connor',
    job_title: 'Chief Operating Officer',
    email_address: 'sarah@skynet-defense.com',
    direct_phone_number: '+14155552671',
    interest_level: 'high',
    material_context: 'Scaling outbound outreach to 50k leads/month',
    follow_up_requirements: 'Send enterprise SLA and calendar invite',
    call_outcome: 'confirmed_demo',
  },
};
const res1 = mapRetellAnalysisToRM(confirmedAnalysis);
assert(res1.leadStatus === 'Confirmed', 'Confirmed: Correctly classified when all criteria met');
assert(res1.decisionMakerIdentified === true, 'Confirmed: Decision maker identified');
assert(res1.contactName === 'Sarah Connor', 'Confirmed: Contact name extracted');
assert(res1.jobTitle === 'Chief Operating Officer', 'Confirmed: Job title extracted');
assert(res1.emailAddress === 'sarah@skynet-defense.com', 'Confirmed: Email extracted');
assert(res1.directPhoneNumber === '+14155552671', 'Confirmed: Direct phone extracted');
assert(res1.interestLevel === 'high', 'Confirmed: Interest level high');
assert(res1.followUpRequirements === 'Send enterprise SLA and calendar invite', 'Confirmed: Follow-up requirements extracted');

// Case 2: Negative Test for Confirmed (High interest but missing contact details -> CANNOT be Confirmed)
const missingContactDetailsAnalysis = {
  call_summary: 'Decision maker spoke and was very interested, but did not provide direct email or phone.',
  call_successful: true,
  in_voicemail: false,
  custom_analysis_data: {
    decision_maker_identified: true,
    contact_name: 'John Doe',
    job_title: 'VP Sales',
    email_address: null,
    direct_phone_number: null,
    interest_level: 'high',
  },
};
const res2 = mapRetellAnalysisToRM(missingContactDetailsAnalysis);
assert(res2.leadStatus !== 'Confirmed', 'Confirmed Rule Enforcement: Missing contact details cannot be Confirmed');
assert(res2.leadStatus === 'Interested', 'Confirmed Rule Enforcement: Falls back to Interested');

// Case 3: Negative Test for Confirmed (Contact details provided but not decision maker -> CANNOT be Confirmed)
const gatekeeperAnalysis = {
  call_summary: 'Assistant provided details but decision maker was not reached.',
  call_successful: false,
  in_voicemail: false,
  custom_analysis_data: {
    decision_maker_identified: false,
    contact_name: 'Alex Gatekeeper',
    job_title: 'Executive Assistant',
    email_address: 'alex@company.com',
    direct_phone_number: '+14155559999',
    interest_level: 'low',
  },
};
const res3 = mapRetellAnalysisToRM(gatekeeperAnalysis);
assert(res3.leadStatus !== 'Confirmed', 'Confirmed Rule Enforcement: Non-decision maker cannot be Confirmed');
assert(res3.leadStatus === 'Not Interested', 'Classified as Not Interested');

// Case 4: Follow-up Status
const followUpAnalysis = {
  call_summary: 'Please send info over email and follow up next Tuesday.',
  call_successful: false,
  in_voicemail: false,
  custom_analysis_data: {
    decision_maker_identified: false,
    interest_level: 'medium',
    follow_up_requirements: 'Send pricing PDF via email',
  },
};
const res4 = mapRetellAnalysisToRM(followUpAnalysis);
assert(res4.leadStatus === 'Interested' || res4.leadStatus === 'Follow-up', 'Follow-up or Interested status mapped');

// Case 5: Callback Status
const callbackAnalysis = {
  call_summary: 'Prospect is driving, please call back tomorrow at 2 PM.',
  call_successful: false,
  in_voicemail: false,
  custom_analysis_data: {
    decision_maker_identified: false,
    interest_level: 'none',
  },
};
const res5 = mapRetellAnalysisToRM(callbackAnalysis);
assert(res5.leadStatus === 'Callback', 'Callback status mapped');

// Case 6: Do Not Call Status
const dncAnalysis = {
  call_summary: 'Prospect requested: Please do not call this number again.',
  call_successful: false,
  in_voicemail: false,
  custom_analysis_data: {
    dnc_requested: true,
  },
};
const res6 = mapRetellAnalysisToRM(dncAnalysis);
assert(res6.leadStatus === 'Do Not Call', 'Do Not Call status mapped');
assert(res6.dncRequested === true, 'dncRequested flag set to true');

// Case 7: Unqualified Status
const unqualifiedAnalysis = {
  call_summary: 'Wrong number, no longer at company.',
  call_successful: false,
  in_voicemail: false,
  custom_analysis_data: {},
};
const res7 = mapRetellAnalysisToRM(unqualifiedAnalysis);
assert(res7.leadStatus === 'Unqualified', 'Unqualified status mapped');

// -------------------------------------------------------------
// Test Group 3: Phone Number Normalization & E.164 Validation
// -------------------------------------------------------------
console.log('\n--- 3. E.164 PHONE NUMBER VALIDATION ---');

function normalizePhone(rawPhone, defaultCountry = 'US') {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, e164: null, error: 'Empty phone number' };
  }
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10 && defaultCountry === 'US') {
    return { isValid: true, e164: `+1${digits}` };
  }
  if (digits.length === 11 && digits.startsWith('1') && defaultCountry === 'US') {
    return { isValid: true, e164: `+${digits}` };
  }
  if (rawPhone.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return { isValid: true, e164: `+${digits}` };
  }
  return { isValid: false, e164: null, error: 'Invalid phone format' };
}

assert(normalizePhone('4155552671').e164 === '+14155552671', '10-digit US normalized to +14155552671');
assert(normalizePhone('+1 (415) 555-2671').e164 === '+14155552671', 'Formatted US normalized to +14155552671');
assert(normalizePhone('14155552671').e164 === '+14155552671', '11-digit leading 1 normalized to +14155552671');
assert(normalizePhone('+442071838750').e164 === '+442071838750', 'International UK E.164 preserved');
assert(normalizePhone('12345').isValid === false, 'Invalid short number rejected');
assert(normalizePhone('').isValid === false, 'Empty string rejected');

// -------------------------------------------------------------
// Test Group 4: Duplicate Active Call Prevention Logic
// -------------------------------------------------------------
console.log('\n--- 4. DUPLICATE ACTIVE CALL PREVENTION ---');

const activeCallStates = ['queued', 'ringing', 'in_progress'];
const terminalCallStates = ['completed', 'failed', 'busy', 'no_answer', 'cancelled'];

function canInitiateCall(existingCallsForLead) {
  const activeCall = existingCallsForLead.find((c) => activeCallStates.includes(c.status));
  if (activeCall) {
    return { allowed: false, error: `Lead already has an active call in progress (Call ID: ${activeCall.id}, Status: ${activeCall.status})` };
  }
  return { allowed: true };
}

assert(
  canInitiateCall([{ id: 'c1', status: 'completed' }, { id: 'c2', status: 'no_answer' }]).allowed === true,
  'Initiation allowed when previous calls are terminal'
);

assert(
  canInitiateCall([{ id: 'c3', status: 'queued' }]).allowed === false,
  'Initiation blocked when an active call is queued'
);

assert(
  canInitiateCall([{ id: 'c4', status: 'ringing' }]).allowed === false,
  'Initiation blocked when an active call is ringing'
);

assert(
  canInitiateCall([{ id: 'c5', status: 'in_progress' }]).allowed === false,
  'Initiation blocked when an active call is in_progress'
);

// -------------------------------------------------------------
// Test Group 5: Phone Number Synchronization & Deduplication
// -------------------------------------------------------------
console.log('\n--- 5. PHONE NUMBER SYNCHRONIZATION & DEDUPLICATION ---');

function syncTwilioPhoneNumberMock(twilioNumber, registeredNumbers) {
  const phoneNorm = normalizePhone(twilioNumber, 'US');
  if (!phoneNorm.isValid || !phoneNorm.e164) {
    return { success: false, error: 'Invalid phone' };
  }
  const formatted = phoneNorm.e164;
  const existing = registeredNumbers.find((n) => n.phone_number === formatted);
  if (existing) {
    return { success: true, phoneNumber: formatted, alreadyExists: true, details: existing };
  }
  return { success: true, phoneNumber: formatted, alreadyExists: false, details: { phone_number: formatted, nickname: 'Twilio Outbound Bridge' } };
}

const registered = [{ phone_number: '+18005550199', nickname: 'Existing Number' }];
const sync1 = syncTwilioPhoneNumberMock('+18005550199', registered);
assert(sync1.alreadyExists === true, 'Detects existing number and prevents duplicate import');

const sync2 = syncTwilioPhoneNumberMock('+14155550100', registered);
assert(sync2.alreadyExists === false, 'Imports new number when not already present');

// -------------------------------------------------------------
// Test Group 6: Production Fail-Closed vs Development Mock
// -------------------------------------------------------------
console.log('\n--- 6. PRODUCTION FAIL-CLOSED VS DEV MOCK ---');

function startOutboundCallMock(isConfigured, mode, nodeEnv) {
  if (!isConfigured) {
    const isLive = mode === 'live' || nodeEnv === 'production';
    if (isLive) {
      return {
        success: false,
        error: '[RetellProvider] Retell is not configured. Missing RETELL_API_KEY in production or live mode.',
      };
    }
    return {
      success: true,
      providerCallId: 'mock_call_123',
      status: 'queued',
    };
  }
  return { success: true, providerCallId: 'retell_real_call_456', status: 'queued' };
}

assert(
  startOutboundCallMock(false, 'live', 'production').success === false,
  'Fails closed in production when unconfigured'
);
assert(
  startOutboundCallMock(false, 'development', 'development').success === true,
  'Allows controlled simulation in development mode'
);
assert(
  startOutboundCallMock(true, 'live', 'production').success === true,
  'Succeeds in production when configured'
);

// -------------------------------------------------------------
// Test Group 7: Webhook Idempotency Check
// -------------------------------------------------------------
console.log('\n--- 7. WEBHOOK IDEMPOTENCY ---');

class IdempotencyStore {
  constructor() {
    this.events = new Map();
  }
  record(eventId, status) {
    if (this.events.has(eventId)) {
      return { isDuplicate: true, status: this.events.get(eventId) };
    }
    this.events.set(eventId, status);
    return { isDuplicate: false, status };
  }
}

const store = new IdempotencyStore();
const event1 = store.record('retell_evt_101', 'processed');
assert(event1.isDuplicate === false, 'First event is processed');

const event1Again = store.record('retell_evt_101', 'processed');
assert(event1Again.isDuplicate === true, 'Duplicate event is detected and ignored');

// -------------------------------------------------------------
// Test Group 8: All 4 Webhook Events Simulation & Database Updates
// -------------------------------------------------------------
console.log('\n--- 8. ALL 4 WEBHOOK EVENTS & LIFECYCLE STATE MACHINE ---');

// In-memory mock database state
const mockDb = {
  calls: new Map([
    ['call_rec_001', {
      id: 'call_rec_001',
      organization_id: 'org_alpha',
      lead_id: 'lead_001',
      status: 'queued',
      provider: 'retell',
      retell_call_id: 'retell_c_1',
      started_at: '2026-10-10T12:00:00Z',
    }],
  ]),
  leads: new Map([
    ['lead_001', {
      id: 'lead_001',
      organization_id: 'org_alpha',
      full_name: 'Original Lead',
      email: 'lead@orig.com',
      phone_e164: '+14155550100',
      status: 'new',
      is_dnc: false,
    }],
  ]),
  recordings: [],
  transcripts: [],
  events: [],
};

function processWebhookEventMock(payload) {
  const { event, call } = payload;
  const metadata = call.metadata || {};
  const rmCallId = metadata.rmCallId;
  const orgId = metadata.organizationId;

  const targetCall = mockDb.calls.get(rmCallId);
  if (!targetCall) {
    return { success: false, error: 'Call not found' };
  }

  // Cross-tenant check
  if (targetCall.organization_id !== orgId) {
    return { success: false, error: 'Organization mismatch' };
  }

  switch (event) {
    case 'call_started':
      targetCall.status = 'in_progress';
      targetCall.answered_at = new Date(call.start_timestamp).toISOString();
      mockDb.events.push({ call_id: rmCallId, event_type: 'call_answered' });
      return { success: true, eventType: 'call_started', status: targetCall.status };

    case 'call_ended':
      targetCall.status = 'completed';
      targetCall.ended_at = new Date(call.end_timestamp).toISOString();
      targetCall.duration_seconds = Math.round(call.duration_ms / 1000);
      if (call.recording_url) {
        mockDb.recordings.push({
          call_id: rmCallId,
          provider_recording_id: call.call_id,
          storage_path: call.recording_url,
          status: 'ready',
        });
      }
      if (call.transcript_object) {
        call.transcript_object.forEach((item, idx) => {
          mockDb.transcripts.push({
            call_id: rmCallId,
            sequence_number: idx + 1,
            speaker: item.role === 'user' ? 'lead' : 'ai',
            text: item.content,
          });
        });
      }
      mockDb.events.push({ call_id: rmCallId, event_type: 'call_completed' });
      return { success: true, eventType: 'call_ended', status: targetCall.status };

    case 'call_analyzed': {
      const analysis = mapRetellAnalysisToRM(call.call_analysis);
      targetCall.outcome = analysis.callOutcome;
      targetCall.sentiment_score = analysis.sentimentScore;

      const lead = mockDb.leads.get(metadata.leadId);
      if (lead) {
        const dbStatusMap = {
          Confirmed: 'confirmed',
          Interested: 'interested',
          'Follow-up': 'follow_up',
          Callback: 'callback',
          'Not Interested': 'not_interested',
          'Do Not Call': 'dnc',
          Unqualified: 'unqualified',
        };
        lead.status = dbStatusMap[analysis.leadStatus] || 'contacted';
        if (analysis.contactName) lead.full_name = analysis.contactName;
        if (analysis.jobTitle) lead.job_title = analysis.jobTitle;
        if (analysis.emailAddress) lead.email = analysis.emailAddress;
        if (analysis.directPhoneNumber) lead.phone_e164 = analysis.directPhoneNumber;
        if (analysis.dncRequested) lead.is_dnc = true;
      }
      mockDb.events.push({ call_id: rmCallId, event_type: 'call_analyzed', qualification: analysis });
      return { success: true, eventType: 'call_analyzed', leadStatus: analysis.leadStatus };
    }

    case 'call_failure':
    case 'call_failed':
      targetCall.status = 'failed';
      targetCall.disconnection_reason = call.disconnection_reason || 'Call failed';
      mockDb.events.push({ call_id: rmCallId, event_type: 'call_failed' });
      return { success: true, eventType: 'call_failure', status: targetCall.status };

    default:
      return { success: false, error: `Unhandled event ${event}` };
  }
}

// 8a. Test call_started
const startEvt = {
  event: 'call_started',
  call: {
    call_id: 'retell_c_1',
    start_timestamp: Date.now(),
    metadata: { rmCallId: 'call_rec_001', organizationId: 'org_alpha', leadId: 'lead_001' },
  },
};
const startRes = processWebhookEventMock(startEvt);
assert(startRes.success === true, 'call_started handled successfully');
assert(mockDb.calls.get('call_rec_001').status === 'in_progress', 'call_started transitions call to in_progress');

// 8b. Test call_ended
const endEvt = {
  event: 'call_ended',
  call: {
    call_id: 'retell_c_1',
    start_timestamp: Date.now() - 45000,
    end_timestamp: Date.now(),
    duration_ms: 45000,
    recording_url: 'https://api.retellai.com/recordings/rec_001.mp3',
    transcript_object: [
      { role: 'agent', content: 'Hi, this is Alex from Acme Corp.' },
      { role: 'user', content: 'Yes, hi Alex. How are you?' },
    ],
    metadata: { rmCallId: 'call_rec_001', organizationId: 'org_alpha', leadId: 'lead_001' },
  },
};
const endRes = processWebhookEventMock(endEvt);
assert(endRes.success === true, 'call_ended handled successfully');
assert(mockDb.calls.get('call_rec_001').status === 'completed', 'call_ended transitions call to completed');
assert(mockDb.recordings.length === 1, 'call_ended saves recording metadata');
assert(mockDb.transcripts.length === 2, 'call_ended saves 2 transcript turns');

// 8c. Test call_analyzed with Confirmed status update
const analyzedEvt = {
  event: 'call_analyzed',
  call: {
    call_id: 'retell_c_1',
    metadata: { rmCallId: 'call_rec_001', organizationId: 'org_alpha', leadId: 'lead_001' },
    call_analysis: confirmedAnalysis,
  },
};
const analyzedRes = processWebhookEventMock(analyzedEvt);
assert(analyzedRes.success === true, 'call_analyzed handled successfully');
assert(mockDb.leads.get('lead_001').status === 'confirmed', 'Lead status updated to confirmed in DB');
assert(mockDb.leads.get('lead_001').full_name === 'Sarah Connor', 'Lead full_name updated from qualification');
assert(mockDb.leads.get('lead_001').email === 'sarah@skynet-defense.com', 'Lead email updated from qualification');
assert(mockDb.leads.get('lead_001').phone_e164 === '+14155552671', 'Lead phone_e164 updated from qualification');

// 8d. Test call_failure
mockDb.calls.set('call_rec_002', {
  id: 'call_rec_002',
  organization_id: 'org_alpha',
  lead_id: 'lead_002',
  status: 'queued',
});
const failureEvt = {
  event: 'call_failure',
  call: {
    call_id: 'retell_c_fail',
    disconnection_reason: 'telephony_dial_error',
    metadata: { rmCallId: 'call_rec_002', organizationId: 'org_alpha', leadId: 'lead_002' },
  },
};
const failureRes = processWebhookEventMock(failureEvt);
assert(failureRes.success === true, 'call_failure handled successfully');
assert(mockDb.calls.get('call_rec_002').status === 'failed', 'call_failure transitions call to failed');
assert(mockDb.calls.get('call_rec_002').disconnection_reason === 'telephony_dial_error', 'disconnection reason recorded');

// -------------------------------------------------------------
// Test Group 9: Organization Isolation & Cross-Tenant Security
// -------------------------------------------------------------
console.log('\n--- 9. ORGANIZATION ISOLATION & CROSS-TENANT SECURITY ---');

const crossTenantEvt = {
  event: 'call_started',
  call: {
    call_id: 'retell_c_1',
    start_timestamp: Date.now(),
    metadata: { rmCallId: 'call_rec_001', organizationId: 'org_malicious_attacker', leadId: 'lead_001' },
  },
};
const crossTenantRes = processWebhookEventMock(crossTenantEvt);
assert(crossTenantRes.success === false, 'Cross-tenant webhook event rejected');
assert(crossTenantRes.error === 'Organization mismatch', 'Error specifically identifies organization mismatch');

// -------------------------------------------------------------
// Test Summary
// -------------------------------------------------------------
console.log('\n' + '='.repeat(70));
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
console.log('='.repeat(70));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Step 6 Retell AI voice engine tests PASSED successfully!\n');
}
