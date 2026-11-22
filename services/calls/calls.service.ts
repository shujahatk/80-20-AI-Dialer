import { CallsRepository, type CallRow, type CallEventRow, type CallRecordingRow } from '@/repositories/calls.repository';
import { LeadsRepository } from '@/repositories/leads.repository';
import { CampaignsRepository } from '@/repositories/campaigns.repository';
import { AgentsRepository } from '@/repositories/agents.repository';
import { CampaignsService } from '@/services/campaigns/campaigns.service';
import { twilioProvider } from '@/services/telephony/TwilioTelephonyProvider';
import { retellCallService } from '@/services/retell/RetellCallService';
import {
  assertValidCallTransition,
  normalizeCallOutcome,
  isTerminalCallState,
} from '@/services/telephony/call-state-machine';
import {
  normalizeTwilioCallStatus,
  twilioStatusToEventType,
} from '@/services/telephony/call-events';
import { normalizePhone } from '@/lib/telephony/phone';
import { getClientEnv, getServerEnv } from '@/lib/env';
import type { CallState, TwilioStatusCallbackPayload, TwilioRecordingCallbackPayload } from '@/services/telephony/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, CallStatusDb } from '@/lib/supabase/types';

export class CallsService {
  private repo: CallsRepository;
  private leadsRepo: LeadsRepository;
  private campaignsRepo: CampaignsRepository;
  private agentsRepo: AgentsRepository;
  private campaignsService: CampaignsService;
  private defaultOrgId: string;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repo = new CallsRepository(supabase);
    this.leadsRepo = new LeadsRepository(supabase);
    this.campaignsRepo = new CampaignsRepository(supabase);
    this.agentsRepo = new AgentsRepository(supabase);
    this.campaignsService = new CampaignsService(supabase);
    this.defaultOrgId = getClientEnv().NEXT_PUBLIC_DEFAULT_ORG_ID;
  }

  /**
   * Asserts lead callability with final runtime DNC and active call guard
   */
  async assertLeadCallable(leadId: string, organizationId: string) {
    const lead = await this.leadsRepo.getById(leadId, organizationId);
    if (!lead) {
      throw new Error(`Lead with ID '${leadId}' does not exist.`);
    }

    if (lead.organization_id !== organizationId) {
      throw new Error('Unauthorized lead access: organization mismatch.');
    }

    if (lead.is_archived) {
      throw new Error(`Lead '${lead.full_name}' is archived and cannot be called.`);
    }

    if (lead.is_dnc || lead.status === 'dnc') {
      throw new Error(`Lead '${lead.full_name}' is on the Do Not Call (DNC) list.`);
    }

    const phoneNorm = normalizePhone(lead.phone_e164 || lead.phone, lead.country || 'US');
    if (!phoneNorm.isValid || !phoneNorm.e164) {
      throw new Error(`Lead '${lead.full_name}' has an invalid callable phone number.`);
    }

    // Duplicate active call prevention
    const activeCall = await this.repo.getActiveCallForLead(leadId, organizationId);
    if (activeCall) {
      throw new Error(`Lead '${lead.full_name}' already has an active call in progress (Call ID: ${activeCall.id}, Status: ${activeCall.status}).`);
    }

    return { lead, phoneNorm };
  }

  /**
   * Initiates a manual or single-operator call, or dispatches to Retell AI if an AI agent is specified
   */
  async initiateCall(params: {
    leadId: string;
    organizationId?: string;
    operatorId?: string | null;
    campaignId?: string | null;
    aiAgentId?: string | null;
    recordCall?: boolean;
  }) {
    const orgId = params.organizationId ?? this.defaultOrgId;

    // Genuine Human Approval Enforcement:
    // Outbound calls cannot be initiated without verified authorization from an authenticated human operator.
    if (!params.operatorId) {
      throw new Error('Human operator authorization required: outbound call cannot be initiated without verified human approval.');
    }

    // 1. Runtime Callability, DNC & Active Call Guard
    const { lead, phoneNorm } = await this.assertLeadCallable(params.leadId, orgId);

    const isAiCall = Boolean(params.aiAgentId);
    const provider = isAiCall ? 'retell' : 'twilio';

    // 2. Create local Call record in DB with verified human approval evidence:
    // provider = 'live', status = 'registered', retell_call_id = null, approved_at populated
    const now = new Date().toISOString();
    const callRecord = await this.repo.create({
      organization_id: orgId,
      lead_id: lead.id,
      campaign_id: params.campaignId || null,
      ai_agent_id: params.aiAgentId || null,
      operator_id: params.operatorId,
      provider: 'live',
      direction: 'outbound',
      status: 'registered',
      retell_call_id: null,
      approved_at: now,
      started_at: now,
      recording_status: params.recordCall ? 'enabled' : 'disabled',
      transcript_status: 'pending',
      provider_metadata: {
        approval: {
          approved_by: params.operatorId,
          approved_at: now,
          method: isAiCall ? 'manual_operator_ai_dispatch' : 'manual_operator_direct_dial',
        },
      } as Json,
    });

    let retellCallId: string | null = null;

    // 3. If Retell AI call, verify persisted human approval before dispatching to Retell
    if (isAiCall && params.aiAgentId) {
      if (!callRecord.approved_at || !callRecord.operator_id) {
        throw new Error('Retell dispatch blocked: call record lacks verified human approval.');
      }
      try {
        const env = getServerEnv();
        const fromNumber = env.TWILIO_PHONE_NUMBER || env.RETELL_PHONE_NUMBER || '+18005550199';

        let retellAgentId = params.aiAgentId;
        let agentVersionId: string | null = null;

        const agent = await this.agentsRepo.getById(params.aiAgentId, orgId);
        if (agent) {
          retellAgentId = agent.retell_agent_id || agent.id;
          agentVersionId = agent.active_version_id || null;
        }

        const dispatchResult = await retellCallService.startOutboundCall({
          fromNumber,
          toNumber: phoneNorm.e164,
          agentId: retellAgentId,
          metadata: {
            organizationId: orgId,
            leadId: lead.id,
            campaignId: params.campaignId || null,
            agentId: params.aiAgentId,
            agentVersionId,
            rmCallId: callRecord.id,
            operatorId: params.operatorId,
          },
        });

        if (dispatchResult.success && dispatchResult.providerCallId) {
          retellCallId = dispatchResult.providerCallId;
          await this.repo.update(callRecord.id, orgId, {
            provider_call_id: retellCallId,
            retell_call_id: retellCallId,
            status: 'queued',
          });
        } else {
          await this.repo.update(callRecord.id, orgId, {
            status: 'failed',
            disconnection_reason: dispatchResult.error || 'Retell call initiation failed',
            ended_at: new Date().toISOString(),
          });
          throw new Error(dispatchResult.error || 'Failed to dispatch call to Retell');
        }
      } catch (dispatchErr: unknown) {
        const errMessage = dispatchErr instanceof Error ? dispatchErr.message : 'Unknown Retell dispatch failure';
        await this.repo.update(callRecord.id, orgId, {
          status: 'failed',
          disconnection_reason: errMessage,
          ended_at: new Date().toISOString(),
        });
        throw dispatchErr;
      }
    }

    // 4. Log call_created event
    await this.repo.logEvent({
      organization_id: orgId,
      call_id: callRecord.id,
      event_type: 'call_created',
      payload: {
        destinationNumber: phoneNorm.e164,
        leadName: lead.full_name,
        campaignId: params.campaignId,
        provider,
        retellCallId,
      } as unknown as Json,
      occurred_at: now,
    });

    return {
      call: callRecord,
      lead,
      destinationNumber: phoneNorm.e164,
      retellCallId,
    };
  }

  /**
   * Prepares the next eligible campaign lead for calling
   */
  async prepareNextCampaignCall(params: {
    campaignId: string;
    organizationId?: string;
    operatorId?: string | null;
  }) {
    const orgId = params.organizationId ?? this.defaultOrgId;

    // Genuine Human Approval Enforcement:
    // Outbound queue calls cannot be prepared without an authenticated human operator claiming the call.
    if (!params.operatorId) {
      throw new Error('Human operator authorization required: queue call cannot be prepared without verified human approval.');
    }

    // 1. Atomically claim next candidate from Phase 4 queue engine
    const nextResult = await this.campaignsService.getNextCallableLead(
      params.campaignId,
      params.operatorId,
      orgId
    );
    if (!nextResult.candidate) {
      return null;
    }
    const nextCandidate = nextResult.candidate;

    try {
      // 2. Final DNC check at call boundary
      const { lead, phoneNorm } = await this.assertLeadCallable(nextCandidate.leadId, orgId);

      // 3. Create call record with verified human approval evidence:
      const now = new Date().toISOString();
      const callRecord = await this.repo.create({
        organization_id: orgId,
        campaign_id: params.campaignId,
        lead_id: lead.id,
        operator_id: params.operatorId,
        provider: 'live',
        direction: 'outbound',
        status: 'registered',
        retell_call_id: null,
        approved_at: now,
        started_at: now,
        recording_status: 'enabled',
        transcript_status: 'pending',
        provider_metadata: {
          approval: {
            approved_by: params.operatorId,
            approved_at: now,
            method: 'queue_operator_claim',
          },
        } as Json,
      });

      // 4. Log call_created event
      await this.repo.logEvent({
        organization_id: orgId,
        call_id: callRecord.id,
        event_type: 'call_created',
        payload: {
          campaignId: params.campaignId,
          leadName: lead.full_name,
          destinationNumber: phoneNorm.e164,
          approvedBy: params.operatorId,
        } as unknown as Json,
        occurred_at: now,
      });

      return {
        call: callRecord,
        lead,
        candidate: nextCandidate,
        destinationNumber: phoneNorm.e164,
      };
    } catch (err: unknown) {
      // Release or fail the claim if lead became DNC or error occurred
      const errorMessage = err instanceof Error ? err.message : 'Unknown preparation failure';
      if (errorMessage.includes('Do Not Call')) {
        await this.campaignsRepo.completeLead(nextCandidate.campaignLeadId, 'dnc');
      } else {
        await this.campaignsRepo.releaseClaim(nextCandidate.campaignLeadId);
      }
      throw err;
    }
  }

  /**
   * Processes incoming Twilio Status Callback webhooks idempotently
   */
  async handleTwilioStatusWebhook(
    payload: TwilioStatusCallbackPayload,
    queryParams: { callId?: string; leadId?: string; campaignId?: string },
    signatureValid: boolean = true
  ) {
    const callSid = payload.CallSid;
    const twilioStatus = payload.CallStatus || 'unknown';
    const sequenceNumber = payload.SequenceNumber || Date.now().toString();
    const externalEventId = `${callSid}_${twilioStatus}_${sequenceNumber}`;

    // 1. Ingest into webhook_events table for idempotency
    const { isDuplicate, event: webhookRecord } = await this.repo.recordWebhookEvent({
      provider: 'twilio',
      external_event_id: externalEventId,
      event_type: `call.${twilioStatus}`,
      payload: payload as unknown as Json,
      signature_valid: signatureValid,
      processing_status: 'received',
    });

    if (isDuplicate && webhookRecord.processing_status === 'processed') {
      return { duplicate: true, status: 'already_processed' };
    }

    try {
      // 2. Find target call record
      let targetCall: CallRow | null = null;
      if (queryParams.callId) {
        targetCall = await this.repo.getById(queryParams.callId);
      }
      if (!targetCall && callSid) {
        targetCall = await this.repo.getByProviderCallId(callSid);
      }

      if (!targetCall) {
        await this.repo.updateWebhookEventStatus(webhookRecord.id, 'ignored', 'Call record not found for webhook');
        return { duplicate: false, status: 'call_not_found' };
      }

      const orgId = targetCall.organization_id;
      await this.repo.assignWebhookOrganization(webhookRecord.id, orgId);
      const normalizedState = normalizeTwilioCallStatus(twilioStatus);
      const currentCallState = targetCall.status as CallState;

      // 3. State transition check
      const canTransition = currentCallState === normalizedState || !isTerminalCallState(currentCallState);

      const now = new Date().toISOString();
      const updatePayload: Partial<CallRow> = {
        provider_call_id: callSid,
        updated_at: now,
      };

      if (canTransition) {
        updatePayload.status = normalizedState as unknown as CallStatusDb;
      }

      if (normalizedState === 'ringing' && !targetCall.ringing_at) {
        updatePayload.ringing_at = now;
      }

      if (normalizedState === 'connected' && !targetCall.answered_at) {
        updatePayload.answered_at = now;
      }

      if (isTerminalCallState(normalizedState)) {
        updatePayload.ended_at = targetCall.ended_at || now;
        const durationSec = parseInt(payload.Duration || payload.CallDuration || '0', 10);
        updatePayload.duration_seconds = durationSec > 0 ? durationSec : targetCall.duration_seconds;

        if (targetCall.answered_at) {
          const answeredTime = new Date(targetCall.answered_at).getTime();
          const endTime = new Date(updatePayload.ended_at).getTime();
          updatePayload.connected_seconds = Math.max(0, Math.floor((endTime - answeredTime) / 1000));
        }

        updatePayload.outcome = normalizeCallOutcome(normalizedState, targetCall.outcome || undefined);
      }

      // Update call record
      const updatedCall = await this.repo.update(targetCall.id, orgId, updatePayload);

      // Log normalized call event
      const eventType = twilioStatusToEventType(twilioStatus);
      await this.repo.logEvent({
        organization_id: orgId,
        call_id: targetCall.id,
        event_type: eventType,
        provider_event_id: callSid,
        payload: {
          twilioStatus,
          duration: payload.Duration,
          callDuration: payload.CallDuration,
        } as unknown as Json,
        occurred_at: now,
      });

      // 4. Update campaign lead retry/membership if linked to a campaign
      if (targetCall.campaign_id && targetCall.lead_id && isTerminalCallState(normalizedState)) {
        const { memberships } = await this.campaignsRepo.getLeadMemberships(targetCall.campaign_id, {});
        const membership = memberships.find((m) => m.leadId === targetCall?.lead_id);
        if (membership) {
          const outcome = normalizeCallOutcome(normalizedState, targetCall.outcome || undefined);
          const isFinalOutcome = ['qualified', 'appointment', 'not_interested', 'wrong_contact', 'dnc'].includes(outcome);

          if (isFinalOutcome) {
            await this.campaignsRepo.completeLead(membership.id, outcome);
          } else {
            const nextAttempt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            await this.campaignsRepo.updateAttempt(membership.id, outcome, nextAttempt);
            await this.campaignsRepo.releaseClaim(membership.id);
          }
        }
      }

      await this.repo.updateWebhookEventStatus(webhookRecord.id, 'processed');
      return { duplicate: false, status: 'processed', call: updatedCall };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown webhook handling error';
      await this.repo.updateWebhookEventStatus(webhookRecord.id, 'failed', msg);
      throw err;
    }
  }

  /**
   * Processes incoming Twilio Recording Callback webhooks
   */
  async handleTwilioRecordingWebhook(
    payload: TwilioRecordingCallbackPayload,
    queryParams: { callId?: string }
  ) {
    const recordingSid = payload.RecordingSid;
    const callSid = payload.CallSid;
    const recordingUrl = payload.RecordingUrl;
    const durationSeconds = parseInt(payload.RecordingDuration || '0', 10);

    let targetCall: CallRow | null = null;
    if (queryParams.callId) {
      targetCall = await this.repo.getById(queryParams.callId);
    }
    if (!targetCall && callSid) {
      targetCall = await this.repo.getByProviderCallId(callSid);
    }

    if (!targetCall) {
      return { status: 'call_not_found' };
    }

    // Save Recording metadata
    const recording = await this.repo.saveRecording({
      call_id: targetCall.id,
      provider: 'twilio',
      provider_recording_id: recordingSid,
      storage_path: recordingUrl,
      duration_seconds: durationSeconds,
      mime_type: 'audio/x-wav',
      status: 'ready',
    });

    // Update call recording status
    await this.repo.update(targetCall.id, targetCall.organization_id, {
      recording_status: 'ready',
    });

    // Log recording_ready event
    await this.repo.logEvent({
      organization_id: targetCall.organization_id,
      call_id: targetCall.id,
      event_type: 'recording_ready',
      provider_event_id: recordingSid,
      payload: {
        recordingUrl,
        durationSeconds,
      } as unknown as Json,
    });

    return { status: 'recording_saved', recording };
  }

  /**
   * Assigns disposition to a call
   */
  async assignDisposition(params: {
    callId: string;
    leadId: string;
    dispositionCode: string;
    notes?: string;
    organizationId?: string;
  }) {
    const orgId = params.organizationId ?? this.defaultOrgId;
    const call = await this.repo.getById(params.callId, orgId);
    if (!call) throw new Error('Call not found');

    const updated = await this.repo.update(call.id, orgId, {
      outcome: params.dispositionCode,
    });

    if (params.dispositionCode === 'dnc') {
      await this.leadsRepo.update(params.leadId, orgId, {
        is_dnc: true,
        dnc_reason: 'Marked DNC by operator during call disposition',
      });
    }

    await this.repo.logEvent({
      organization_id: orgId,
      call_id: call.id,
      event_type: 'completed',
      payload: {
        outcome: params.dispositionCode,
        notes: params.notes,
      } as unknown as Json,
    });

    return updated;
  }

  async getCalls(organizationId?: string, limit: number = 50) {
    const orgId = organizationId ?? this.defaultOrgId;
    return this.repo.list(orgId, limit);
  }

  async getCallById(id: string, organizationId?: string) {
    const orgId = organizationId ?? this.defaultOrgId;
    return this.repo.getById(id, orgId);
  }

  async getCallEvents(callId: string) {
    return this.repo.getEvents(callId);
  }

  async getCallRecording(callId: string) {
    return this.repo.getRecordingByCallId(callId);
  }

  async recordTranscriptSegment(params: {
    callId: string;
    speaker: 'ai' | 'lead' | 'operator' | 'system';
    sequenceNumber: number;
    text: string;
    startedAtMs?: number;
    endedAtMs?: number;
    confidence?: number;
    metadata?: Record<string, unknown>;
  }) {
    return this.repo.saveTranscriptSegment({
      call_id: params.callId,
      speaker: params.speaker,
      sequence_number: params.sequenceNumber,
      text: params.text,
      started_at_ms: params.startedAtMs || 0,
      ended_at_ms: params.endedAtMs || 0,
      confidence: params.confidence || 0.98,
      metadata: (params.metadata || {}) as Json,
    });
  }

  async getCallTranscripts(callId: string) {
    return this.repo.getTranscriptsByCallId(callId);
  }
}
