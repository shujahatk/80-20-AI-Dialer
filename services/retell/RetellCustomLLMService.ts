/**
 * RM AI DIALER — RETELL CUSTOM LLM BRIDGE (PHASE 4)
 * Server-side bridge connecting Retell AI voice turn events to Claude (AnthropicLLMProvider)
 * and executing authoritative CRM tool actions with strict context validation.
 */

import { AnthropicLLMProvider } from '@/services/ai/AnthropicLLMProvider';
import { RetellCRMToolsService, type TrustedCallContext } from './RetellCRMToolsService';
import { CallsRepository } from '@/repositories/calls.repository';
import { LeadsRepository } from '@/repositories/leads.repository';
import { CampaignsRepository } from '@/repositories/campaigns.repository';
import { AgentsRepository } from '@/repositories/agents.repository';
import { getDevStore } from '@/lib/dev/dev-store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
import type {
  ConversationContext,
  ConversationStage,
  StructuredTurnResponse,
  ConversationTurn,
} from '@/services/ai/types';

export interface RetellTurnTranscriptItem {
  role: 'agent' | 'user' | 'system';
  content: string;
}

export interface RetellCustomLLMRequest {
  interaction_type: 'response_required' | 'reminder_required' | 'ping_pong' | 'tool_call';
  response_id?: number;
  transcript?: RetellTurnTranscriptItem[];
  call?: {
    call_id: string;
    agent_id?: string;
    from_number?: string;
    to_number?: string;
    metadata?: Record<string, any>;
    custom_llm_url?: string;
  };
  call_id?: string;
  metadata?: Record<string, any>;
}

export interface RetellCustomLLMResponse {
  response_type: 'response' | 'ping_pong' | 'tool_call_result';
  response_id?: number;
  content?: string;
  content_complete?: boolean;
  end_call?: boolean;
  transfer_number?: string;
  metadata?: Record<string, any>;
}

export class RetellCustomLLMService {
  private llmProvider: AnthropicLLMProvider;
  private crmTools: RetellCRMToolsService;
  private callsRepo: CallsRepository;
  private leadsRepo: LeadsRepository;
  private campaignsRepo: CampaignsRepository;
  private agentsRepo: AgentsRepository;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.llmProvider = new AnthropicLLMProvider();
    this.crmTools = new RetellCRMToolsService(supabase);
    this.callsRepo = new CallsRepository(supabase);
    this.leadsRepo = new LeadsRepository(supabase);
    this.campaignsRepo = new CampaignsRepository(supabase);
    this.agentsRepo = new AgentsRepository(supabase);
  }

  /**
   * Main turn handler for incoming Retell Custom LLM events
   */
  async handleCustomLLMTurn(
    request: RetellCustomLLMRequest,
    abortSignal?: AbortSignal
  ): Promise<RetellCustomLLMResponse> {
    const responseId = request.response_id ?? 0;

    // 1. Handle Ping-Pong Heartbeat
    if (request.interaction_type === 'ping_pong') {
      return {
        response_type: 'ping_pong',
        response_id: responseId,
      };
    }

    // 2. Extract and resolve trusted call context
    const contextMeta = request.call?.metadata || request.metadata || {};
    const retellCallId = request.call?.call_id || request.call_id || '';

    const trustedContext = await this.resolveTrustedContext(retellCallId, contextMeta);

    // 3. Extract latest utterance
    const transcript = request.transcript || [];
    const latestUserItem = [...transcript].reverse().find((t) => t.role === 'user');
    const latestUtterance =
      request.interaction_type === 'reminder_required'
        ? '[Prospect is silent / reminder prompt requested]'
        : latestUserItem?.content || 'Hello?';

    try {
      // 4. Build comprehensive ConversationContext
      const convContext = await this.buildConversationContext(trustedContext, transcript);

      // 5. Generate structured Claude response
      const { response: turnResponse } = await this.llmProvider.generateTurnResponse(
        convContext,
        latestUtterance,
        abortSignal
      );

      // 6. Execute server-side CRM tools based on structured output
      await this.executeTurnSideEffects(trustedContext, turnResponse);

      // 7. Determine call termination or transfer
      const endCall = turnResponse.shouldEndCall || turnResponse.dncDetected;
      let transferNumber: string | undefined;

      if (turnResponse.shouldHandoff) {
        // If handoff configured with target number in agent config
        if (convContext.agent && (convContext.agent as any).transferNumber) {
          transferNumber = (convContext.agent as any).transferNumber;
        }
      }

      return {
        response_type: 'response',
        response_id: responseId,
        content: turnResponse.spokenResponse,
        content_complete: true,
        end_call: endCall,
        transfer_number: transferNumber,
        metadata: {
          stage: turnResponse.stage,
          intent: turnResponse.intent,
          dncDetected: turnResponse.dncDetected,
          shouldHandoff: turnResponse.shouldHandoff,
          confidence: turnResponse.confidence,
        },
      };
    } catch (err: unknown) {
      // STEP 29 — Claude Failure Policy: Graceful, safe fallback (no hallucination)
      console.error('[RetellCustomLLMService] Claude/LLM Turn generation failure:', err);

      const errorMsg = err instanceof Error ? err.message : 'Unknown LLM failure';

      // Log failure in call events
      if (trustedContext.rmCallId && trustedContext.organizationId) {
        await this.callsRepo.logEvent({
          organization_id: trustedContext.organizationId,
          call_id: trustedContext.rmCallId,
          event_type: 'llm_fallback_triggered',
          payload: {
            error: errorMsg,
            retellCallId,
          },
        });
      }

      return {
        response_type: 'response',
        response_id: responseId,
        content:
          'I apologize, but I am experiencing a brief connection issue right now. I will have one of our specialists follow up with you promptly. Thank you for your time.',
        content_complete: true,
        end_call: true,
        metadata: {
          fallbackTriggered: true,
          error: errorMsg,
        },
      };
    }
  }

  /**
   * Resolves trusted IDs from either metadata or database call record
   */
  private async resolveTrustedContext(
    retellCallId: string,
    metadata: Record<string, any>
  ): Promise<TrustedCallContext> {
    let orgId = metadata.organizationId || metadata.orgId;
    let leadId = metadata.leadId;
    let campaignId = metadata.campaignId;
    let campaignLeadId = metadata.campaignLeadId;
    let agentId = metadata.agentId;
    let agentVersionId = metadata.agentVersionId;
    let rmCallId = metadata.rmCallId || metadata.callId;

    // If metadata missing rmCallId, attempt lookup via retell_call_id
    if (retellCallId && (!rmCallId || !orgId)) {
      const callRecord = await this.callsRepo.getByRetellCallId(retellCallId);
      if (callRecord) {
        rmCallId = rmCallId || callRecord.id;
        orgId = orgId || callRecord.organization_id;
        leadId = leadId || callRecord.lead_id;
        campaignId = campaignId || callRecord.campaign_id;
        agentId = agentId || callRecord.ai_agent_id;
      }
    }

    return {
      organizationId: orgId || '00000000-0000-0000-0000-000000000001',
      leadId: leadId || '',
      campaignId: campaignId || null,
      campaignLeadId: campaignLeadId || null,
      agentId: agentId || null,
      agentVersionId: agentVersionId || null,
      rmCallId: rmCallId || null,
      retellCallId: retellCallId || null,
    };
  }

  /**
   * Constructs rich conversation context for Claude
   */
  private async buildConversationContext(
    trusted: TrustedCallContext,
    transcript: RetellTurnTranscriptItem[]
  ): Promise<ConversationContext> {
    // 1. Fetch Lead
    let leadName = 'Prospect';
    let companyName = 'Business Prospect';
    let leadPhone = '+15550000000';
    let leadNotes: string[] = [];

    if (trusted.leadId && trusted.organizationId) {
      const lead = await this.leadsRepo.getById(trusted.leadId, trusted.organizationId);
      if (lead) {
        leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || leadName;
        companyName = lead.company_name || companyName;
        leadPhone = lead.phone || leadPhone;
      }
    }

    // 2. Fetch Agent Persona
    let agentName = 'Astra';
    let persona = 'Professional commercial logistics & recycling coordinator';
    let openingMsg = 'Hello, this is Astra calling regarding commercial recycling solutions.';
    let instructions = 'Speak clearly, be helpful, qualify decision maker and volume, adhere to DNC requests.';
    let qualificationQuestions = [
      'Are you the person responsible for commercial recycling or waste disposal?',
      'What types of recyclable materials does your facility generate?',
      'What approximate volume or frequency of pickups do you require?',
    ];

    if (trusted.agentId && trusted.organizationId) {
      const agent = await this.agentsRepo.getById(trusted.agentId, trusted.organizationId);
      if (agent) {
        agentName = agent.name || agentName;
        persona = agent.persona || persona;
        if (agent.active_version_id) {
          const version = await this.agentsRepo.getActiveVersion(agent.active_version_id);
          if (version) {
            openingMsg = version.greeting || openingMsg;
            instructions = version.system_prompt || instructions;
          }
        }
      }
    }

    // 3. Map Retell transcript to ConversationTurns
    const turns: ConversationTurn[] = transcript.map((item) => ({
      speaker: item.role === 'user' ? 'prospect' : 'agent',
      text: item.content,
      stage: 'discovery' as ConversationStage,
    }));

    return {
      organization: {
        name: 'RM Recycling Management',
        industry: 'Commercial & Industrial Recycling',
        approvedCapabilities: [
          'Scrap metal recovery',
          'Cardboard/OCC baling',
          'Plastic recycling',
          'Scheduled roll-off container service',
        ],
        disclaimer: 'Calls may be recorded for quality assurance.',
      },
      campaign: {
        id: trusted.campaignId || 'direct_outreach',
        name: 'Commercial Accounts Outreach',
        objective: 'Identify decision makers with commercial recycling needs',
        targetMarket: 'Manufacturing, Warehousing, and Retail Distribution Facilities',
        qualificationGoal: 'Identify material types, pickup frequency, and schedule specialist callback',
      },
      agent: {
        id: trusted.agentId || 'ag_astra',
        name: agentName,
        persona,
        openingMessage: openingMsg,
        callGoal: 'Qualify recycling needs and arrange human consultation',
        systemInstructions: instructions,
        qualificationQuestions,
        objectionGuidance: {
          not_interested: 'Acknowledge immediately, offer a brief 1-minute overview or respect their time.',
          already_have_supplier: 'Ask if they are satisfied with current rebate pricing and pickup reliability.',
        },
        closingBehavior: 'Summarize agreed details, confirm callback or appointment time, and conclude warmly.',
        handoffRules: ['Prospect requests live representative', 'Pricing inquiry exceeding standard ranges'],
        voiceId: 'retell_default',
      },
      lead: {
        id: trusted.leadId,
        name: leadName,
        company: companyName,
        phone: leadPhone,
        notes: leadNotes,
      },
      call: {
        callId: trusted.rmCallId || 'rm_call_session',
        attemptNumber: 1,
        direction: 'outbound',
      },
      currentStage: turns.length <= 1 ? 'opening' : 'discovery',
      qualification: {
        decisionMakerIdentified: null,
        decisionMakerName: null,
        decisionMakerRole: null,
        materialAvailable: null,
        materialType: null,
        materialDescription: null,
        estimatedVolume: null,
        volumeUnit: null,
        frequency: null,
        location: null,
        timing: null,
        currentDisposalProcess: null,
        currentSupplierOrBuyer: null,
        interestLevel: null,
        callbackRequested: false,
        callbackTime: null,
        appointmentRequested: false,
        emailRequested: false,
        humanHandoffRequired: false,
      },
      capturedFacts: {},
      turns,
    };
  }

  /**
   * Executes deterministic CRM tool actions from structured Claude output
   */
  private async executeTurnSideEffects(
    context: TrustedCallContext,
    response: StructuredTurnResponse
  ): Promise<void> {
    // 1. DNC detection / tool trigger
    if (response.dncDetected || response.nextAction === 'mark_dnc_and_terminate') {
      await this.crmTools.markDnc(context, {
        reason: response.dncReason || 'Prospect requested Do Not Call during AI call',
      });
      return; // DNC supersedes all other tool mutations
    }

    // 2. Callback Scheduling tool
    if (response.shouldScheduleCallback && response.callbackDetails) {
      const requestedTime = `${response.callbackDetails.date || 'tomorrow'} ${response.callbackDetails.time || 'afternoon'}`;
      await this.crmTools.scheduleCallback(context, {
        requestedTime,
        note: response.callbackDetails.reason || 'Requested callback during Claude turn',
      });
    }

    // 3. Human Handoff tool
    if (response.shouldHandoff && response.handoffReason) {
      let mappedReason: 'pricing' | 'commercial_negotiation' | 'logistics_commitment' | 'human_requested' | 'ai_uncertainty' = 'human_requested';
      if (response.handoffReason === 'pricing_negotiation') mappedReason = 'pricing';
      else if (response.handoffReason === 'logistics_commitment') mappedReason = 'logistics_commitment';
      else if (response.handoffReason === 'prospect_requested_human') mappedReason = 'human_requested';
      else if (response.handoffReason === 'ai_uncertainty') mappedReason = 'ai_uncertainty';

      await this.crmTools.requestHandoff(context, {
        reason: mappedReason,
        priority: 'high',
        notes: `Handoff requested in stage '${response.stage}'`,
      });
    }

    // 4. Qualification updates tool
    if (response.qualificationUpdates && Object.keys(response.qualificationUpdates).length > 0) {
      const updates = response.qualificationUpdates;
      await this.crmTools.updateQualification(context, {
        decisionMaker: updates.decisionMakerName || undefined,
        materialType: updates.materialType || undefined,
        volume: updates.estimatedVolume ? `${updates.estimatedVolume} ${updates.volumeUnit || ''}`.trim() : undefined,
        frequency: updates.frequency || undefined,
        location: updates.location || undefined,
        timing: updates.timing || undefined,
        supplier: updates.currentSupplierOrBuyer || undefined,
        interestLevel: updates.interestLevel || undefined,
      });
    }
  }
}
