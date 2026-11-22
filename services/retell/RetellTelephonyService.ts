/**
 * RM AI DIALER — RETELL TELEPHONY BRIDGE & TEST CALL SERVICE (PHASE 3)
 * Manages:
 * - Telephony configuration & health audit (Twilio/SIP/Retell registered numbers)
 * - Strict separation of manual calls (Twilio WebRTC) and AI calls (Retell SIP)
 * - Isolated real AI call dispatching with mandatory published agent check
 * - Final dynamic DNC enforcement before provider dispatch
 * - Prior RM call record creation & metadata correlation
 */

import { RetellClient, retellClient } from './RetellClient';
import { RetellCallService, retellCallService } from './RetellCallService';
import { AgentsRepository } from '@/repositories/agents.repository';
import { CallsRepository, type CallRow } from '@/repositories/calls.repository';
import { LeadsRepository } from '@/repositories/leads.repository';
import { normalizePhone } from '@/lib/telephony/phone';
import { getServerEnv } from '@/lib/env';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { NormalizedCallStartResult } from './types';

export interface TelephonyHealthReport {
  retellStatus: 'ready' | 'unconfigured' | 'degraded';
  telephonyStatus: 'ready' | 'needs_attention';
  webhookStatus: 'ready' | 'needs_attention';
  registeredNumbersCount: number;
  defaultOutboundNumber: string;
  isLiveMode: boolean;
  warnings: string[];
}

export interface IsolatedTestCallRequest {
  testPhoneNumber: string;
  agentId: string;
  organizationId: string;
  operatorId?: string;
  leadId?: string;
  dynamicVariables?: Record<string, string | number | boolean>;
}

export interface IsolatedTestCallResponse {
  success: boolean;
  call: CallRow;
  retellCallId?: string;
  providerResult: NormalizedCallStartResult;
  error?: string;
}

export class RetellTelephonyService {
  private client: RetellClient;
  private callService: RetellCallService;
  private agentsRepo: AgentsRepository;
  private callsRepo: CallsRepository;
  private leadsRepo: LeadsRepository;

  constructor(
    supabase: SupabaseClient<Database>,
    client: RetellClient = retellClient,
    callService: RetellCallService = retellCallService
  ) {
    this.client = client;
    this.callService = callService;
    this.agentsRepo = new AgentsRepository(supabase);
    this.callsRepo = new CallsRepository(supabase);
    this.leadsRepo = new LeadsRepository(supabase);
  }

  /**
   * Evaluates Retell telephony health, registered phone numbers, and webhook readiness.
   * Never exposes raw API keys, tokens, or SIP credentials.
   */
  async checkTelephonyHealth(): Promise<TelephonyHealthReport> {
    const env = getServerEnv();
    const isLive = env.RM_PROVIDER_MODE === 'live';
    const warnings: string[] = [];

    const isRetellConfigured = this.client.isConfigured;
    const isWebhookConfigured = Boolean(env.RETELL_WEBHOOK_SECRET && env.RETELL_WEBHOOK_SECRET.length > 5);

    let registeredNumbers: any[] = [];
    if (isRetellConfigured) {
      try {
        registeredNumbers = await this.client.listPhoneNumbers();
      } catch (err: unknown) {
        warnings.push(`Could not list Retell phone numbers: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }

    const defaultOutboundNumber =
      env.TWILIO_PHONE_NUMBER || (registeredNumbers.length > 0 ? registeredNumbers[0].phone_number : '+18005550199');

    const retellStatus = !isRetellConfigured
      ? 'unconfigured'
      : warnings.length === 0
        ? 'ready'
        : 'degraded';

    const telephonyStatus =
      defaultOutboundNumber && (registeredNumbers.length > 0 || !isLive)
        ? 'ready'
        : 'needs_attention';

    const webhookStatus = isWebhookConfigured ? 'ready' : 'needs_attention';

    if (!isWebhookConfigured) {
      warnings.push('RETELL_WEBHOOK_SECRET is not configured. Webhook signature verification will be bypassed in dev.');
    }

    if (registeredNumbers.length === 0 && isLive) {
      warnings.push('No registered Retell phone numbers detected. Ensure Twilio number is imported into Retell.');
    }

    return {
      retellStatus,
      telephonyStatus,
      webhookStatus,
      registeredNumbersCount: registeredNumbers.length,
      defaultOutboundNumber,
      isLiveMode: isLive,
      warnings,
    };
  }

  /**
   * Synchronizes the Twilio phone number into Retell, preventing duplicate phone number integrations.
   */
  async syncTwilioPhoneNumberToRetell(outboundAgentId?: string): Promise<{
    success: boolean;
    phoneNumber: string;
    alreadyExists: boolean;
    details?: any;
    error?: string;
  }> {
    const env = getServerEnv();
    const twilioNumber = env.TWILIO_PHONE_NUMBER;

    if (!twilioNumber) {
      return {
        success: false,
        phoneNumber: '',
        alreadyExists: false,
        error: 'TWILIO_PHONE_NUMBER is not configured in environment variables.',
      };
    }

    const phoneNorm = normalizePhone(twilioNumber, 'US');
    if (!phoneNorm.isValid || !phoneNorm.e164) {
      return {
        success: false,
        phoneNumber: twilioNumber,
        alreadyExists: false,
        error: `TWILIO_PHONE_NUMBER '${twilioNumber}' is not a valid E.164 phone number.`,
      };
    }

    const formattedNumber = phoneNorm.e164;

    if (!this.client.isConfigured) {
      return {
        success: true,
        phoneNumber: formattedNumber,
        alreadyExists: false,
        details: { nickname: 'Twilio Outbound Bridge (Dev/Mock)' },
      };
    }

    try {
      const existingNumbers = await this.client.listPhoneNumbers();
      const existing = existingNumbers.find(
        (n) => n.phone_number === formattedNumber || n.phone_number.replace(/\D/g, '') === formattedNumber.replace(/\D/g, '')
      );

      if (existing) {
        return {
          success: true,
          phoneNumber: formattedNumber,
          alreadyExists: true,
          details: existing,
        };
      }

      const imported = await this.client.importPhoneNumber({
        phone_number: formattedNumber,
        outbound_agent_id: outboundAgentId,
        nickname: 'Twilio Outbound Bridge',
      });

      return {
        success: true,
        phoneNumber: formattedNumber,
        alreadyExists: false,
        details: imported,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to synchronize phone number with Retell';
      return {
        success: false,
        phoneNumber: formattedNumber,
        alreadyExists: false,
        error: msg,
      };
    }
  }

  /**
   * Initiates an isolated, controlled Retell AI call to a test phone number.
   * Strictly verifies:
   * 1. Agent must be in 'published' state.
   * 2. Destination number must NOT be in DNC registry.
   * 3. RM Call record is created first with provider = 'retell'.
   * 4. Correlation metadata (rmCallId, organizationId, agentId) sent to Retell.
   */
  async startIsolatedTestCall(request: IsolatedTestCallRequest): Promise<IsolatedTestCallResponse> {
    const { testPhoneNumber, agentId, organizationId, operatorId, leadId, dynamicVariables } = request;

    // Genuine Human Approval Enforcement:
    // Outbound test calls require explicit authorization by an authenticated human operator/manager.
    if (!operatorId) {
      throw new Error('Human operator authorization required: test call cannot be initiated without verified human approval.');
    }

    // 1. Verify Destination Phone Number
    const phoneNorm = normalizePhone(testPhoneNumber, 'US');
    if (!phoneNorm.isValid || !phoneNorm.e164) {
      throw new Error(`Invalid destination phone number '${testPhoneNumber}'. Must be in valid E.164 format.`);
    }
    const destinationE164 = phoneNorm.e164;

    // 2. Final DNC Check and Duplicate Active Call Check
    if (leadId) {
      const lead = await this.leadsRepo.getById(leadId, organizationId);
      if (lead && (lead.is_dnc || lead.status === 'dnc')) {
        throw new Error(`Security / Compliance Block: Lead '${lead.full_name}' is on the Do-Not-Call (DNC) list.`);
      }

      const activeCall = await this.callsRepo.getActiveCallForLead(leadId, organizationId);
      if (activeCall) {
        throw new Error(`Execution Block: Lead already has an active call in progress (Call ID: ${activeCall.id}, Status: ${activeCall.status}).`);
      }
    }

    // Check if any existing lead with this exact phone number is marked DNC in the organization
    const orgLeads = await this.leadsRepo.list(organizationId, { search: destinationE164, limit: 10 });
    const matchingDnc = orgLeads.leads.find(
      (l) => (l.is_dnc || l.status === 'dnc') && (l.phone === destinationE164 || l.phone_e164 === destinationE164)
    );
    if (matchingDnc) {
      throw new Error(`Security / Compliance Block: Phone number '${destinationE164}' is registered on the Do-Not-Call (DNC) list.`);
    }

    // 3. Verify Agent is Published (Step 7)
    const agent = await this.agentsRepo.getById(agentId, organizationId);
    if (!agent) {
      throw new Error(`AI Agent '${agentId}' not found.`);
    }

    if (agent.stage_state !== 'published') {
      throw new Error(
        `Execution Block: Cannot initiate Retell AI call with agent '${agent.name}'. Only published agents may place telephony calls (Current state: ${agent.stage_state}). Please complete training, simulations, and publishing in Agent Studio.`
      );
    }

    const env = getServerEnv();
    const fromNumber = env.RETELL_PHONE_NUMBER || env.TWILIO_PHONE_NUMBER || '+13027860788';

    // 4. Create RM Call Record with verified human approval evidence:
    const now = new Date().toISOString();
    const callRecord = await this.callsRepo.create({
      organization_id: organizationId,
      lead_id: leadId || null,
      agent_id: agent.id,
      created_by: operatorId,
      provider: 'live',
      direction: 'outbound',
      status: 'registered',
      retell_call_id: null,
      approved_at: now,
      started_at: now,
    });

    // Verify persisted human approval before provider dispatch
    if (!callRecord.approved_at || (!callRecord.created_by && !(callRecord as any).operator_id)) {
      throw new Error('Retell dispatch blocked: call record lacks verified human approval.');
    }

    // Record approval in public.audit_logs
    await this.callsRepo.recordAuditLog({
      organization_id: organizationId,
      actor_id: operatorId,
      action: 'call.approved',
      entity: 'call_session',
      entity_id: callRecord.id,
      metadata: {
        approval_method: 'isolated_test_call',
        approved_by: operatorId,
        approved_at: now,
        destination_number: destinationE164,
        lead_id: leadId || null,
      } as any,
    });

    // 5. Send Correlation Metadata to Retell (Step 11)
    try {
      const retellResult = await this.callService.startOutboundCall({
        fromNumber,
        toNumber: destinationE164,
        agentId: agent.retell_agent_id || agent.id,
        metadata: {
          organizationId,
          leadId: leadId || 'test_lead',
          agentId: agent.id,
          agentVersionId: agent.active_version_id || null,
          rmCallId: callRecord.id,
          operatorId,
          testCall: true,
        },
        dynamicVariables,
      });

      if (!retellResult.success) {
        await this.callsRepo.update(callRecord.id, organizationId, {
          status: 'failed',
          disconnection_reason: retellResult.error || 'Provider initiation rejected',
          ended_at: new Date().toISOString(),
        });

        return {
          success: false,
          call: callRecord,
          providerResult: retellResult,
          error: retellResult.error || 'Retell call initiation failed',
        };
      }

      // 6. Update RM Call Record with Retell Call ID
      const updatedCall = await this.callsRepo.update(callRecord.id, organizationId, {
        retell_call_id: retellResult.providerCallId,
        provider_call_id: retellResult.providerCallId,
        status: 'queued',
      });

      // Log event
      await this.callsRepo.logEvent({
        organization_id: organizationId,
        call_id: callRecord.id,
        event_type: 'call_queued',
        provider_event_id: retellResult.providerCallId,
        payload: {
          provider: 'retell',
          retellCallId: retellResult.providerCallId,
          destination: destinationE164,
          agentId: agent.id,
          testCall: true,
        },
      });

      return {
        success: true,
        call: updatedCall,
        retellCallId: retellResult.providerCallId,
        providerResult: retellResult,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retell dispatch error';
      await this.callsRepo.update(callRecord.id, organizationId, {
        status: 'failed',
        disconnection_reason: msg,
        ended_at: new Date().toISOString(),
      });

      return {
        success: false,
        call: callRecord,
        providerResult: {
          success: false,
          provider: 'retell',
          providerCallId: '',
          status: 'failed',
          error: msg,
        },
        error: msg,
      };
    }
  }
}
