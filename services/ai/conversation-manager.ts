import type { ILLMProvider } from './LLMProvider';
import type {
  ConversationContext,
  StructuredTurnResponse,
  CallSummaryResult,
  ConversationTurn,
  QualificationModel,
} from './types';
import { anthropicLLMProvider } from './AnthropicLLMProvider';
import { buildConversationContext } from './conversation-context';
import {
  createInitialQualificationModel,
  mergeQualificationUpdates,
  evaluateQualificationCompleteness,
} from './qualification-engine';
import { LeadsRepository } from '@/repositories/leads.repository';
import { CallsRepository } from '@/repositories/calls.repository';
import { LeadNotesRepository } from '@/repositories/lead-notes.repository';
import { CampaignsRepository } from '@/repositories/campaigns.repository';
import type { Database } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export class ConversationManager {
  private llm: ILLMProvider;
  private leadsRepo?: LeadsRepository;
  private callsRepo?: CallsRepository;
  private notesRepo?: LeadNotesRepository;
  private campaignsRepo?: CampaignsRepository;

  // Active in-memory session contexts keyed by callId
  private activeSessions: Map<string, ConversationContext> = new Map();

  constructor(
    llmProvider: ILLMProvider = anthropicLLMProvider,
    supabaseClient?: SupabaseClient<Database>
  ) {
    this.llm = llmProvider;
    if (supabaseClient) {
      this.leadsRepo = new LeadsRepository(supabaseClient);
      this.callsRepo = new CallsRepository(supabaseClient);
      this.notesRepo = new LeadNotesRepository(supabaseClient);
      this.campaignsRepo = new CampaignsRepository(supabaseClient);
    }
  }

  /**
   * Initializes or gets existing conversation context for a call
   */
  getOrCreateContext(params: {
    callId: string;
    lead: {
      id: string;
      name: string;
      company: string;
      phone: string;
      jobTitle?: string;
      email?: string | null;
      city?: string;
      region?: string;
      timezone?: string;
      notes?: string[];
      tags?: string[];
    };
    campaign?: {
      id: string;
      name: string;
      objective?: string;
      targetMarket?: string;
      qualificationGoal?: string;
    };
    agentName?: string;
    voiceId?: string;
  }): ConversationContext {
    const existing = this.activeSessions.get(params.callId);
    if (existing) return existing;

    const ctx = buildConversationContext({
      callId: params.callId,
      lead: params.lead,
      campaign: params.campaign,
      agent: { name: params.agentName, voiceId: params.voiceId },
    });

    this.activeSessions.set(params.callId, ctx);
    return ctx;
  }

  /**
   * Processes prospect turn through Claude and updates structured sales intelligence state
   */
  async processTurn(
    callId: string,
    prospectUtterance: string,
    abortSignal?: AbortSignal
  ): Promise<{ response: StructuredTurnResponse; context: ConversationContext }> {
    let context = this.activeSessions.get(callId);
    if (!context) {
      throw new Error(`[ConversationManager] No active session found for callId: ${callId}`);
    }

    // 1. Record prospect utterance into conversation history
    const prospectTurn: ConversationTurn = {
      speaker: 'prospect',
      text: prospectUtterance,
      timestampMs: Date.now(),
      stage: context.currentStage,
    };
    context.turns.push(prospectTurn);

    // 2. Execute Claude reasoning and structured output extraction
    const { response, stats } = await this.llm.generateTurnResponse(
      context,
      prospectUtterance,
      abortSignal
    );

    // 3. Update Conversation Stage
    context.currentStage = response.stage;

    // 4. Merge Extracted Facts
    Object.assign(context.capturedFacts, response.extractedFacts);

    // 5. Merge Qualification Updates
    context.qualification = mergeQualificationUpdates(
      context.qualification,
      response.qualificationUpdates
    );

    // 6. Record Agent Spoken Utterance
    const agentTurn: ConversationTurn = {
      speaker: 'agent',
      text: response.spokenResponse,
      timestampMs: Date.now(),
      stage: response.stage,
    };
    context.turns.push(agentTurn);

    // 7. Handle Critical Safety Actions
    if (response.dncDetected) {
      await this.handleDncEnforcement(context, response.dncReason || 'Opt-out requested during call');
    }

    return { response, context };
  }

  /**
   * Finalizes call session, creates structured summary, and logs AI note
   */
  async finalizeSession(callId: string, organizationId?: string): Promise<CallSummaryResult> {
    const context = this.activeSessions.get(callId);
    if (!context) {
      return {
        summary: 'Call session completed.',
        keyFacts: [],
        qualification: createInitialQualificationModel(),
        objections: [],
        outcome: 'completed',
        nextAction: 'Follow up as needed',
        handoffRequired: false,
        leadNote: 'Call completed.',
      };
    }

    // 1. Generate structured summary
    const summary = await this.llm.generateCallSummary(context);

    // 2. Evaluate final qualification completeness
    const completeness = evaluateQualificationCompleteness(context.qualification);

    // 3. Save AI Note to Lead Notes Repository if available
    const orgId = organizationId || '00000000-0000-0000-0000-000000000001';
    if (this.notesRepo) {
      try {
        await this.notesRepo.create({
          lead_id: context.lead.id,
          author_id: '00000000-0000-0000-0000-000000000001',
          content: `[AI Call Summary]: ${summary.leadNote}`,
        });
      } catch (err) {
        console.warn('[ConversationManager] Failed to persist AI lead note', err);
      }
    }

    // 4. Update Call Outcome in Calls Repository if available
    if (this.callsRepo) {
      try {
        await this.callsRepo.update(callId, orgId, {
          outcome: completeness.recommendedDisposition,
          status: 'completed',
        });
      } catch (err) {
        console.warn('[ConversationManager] Failed to update call disposition', err);
      }
    }

    return summary;
  }

  /**
   * Strict DNC Enforcement handler
   */
  private async handleDncEnforcement(context: ConversationContext, reason: string): Promise<void> {
    const orgId = '00000000-0000-0000-0000-000000000001';
    if (this.leadsRepo) {
      try {
        await this.leadsRepo.markDnc(context.lead.id, orgId, reason);
      } catch (err) {
        console.warn('[ConversationManager] Failed to mark lead DNC', err);
      }
    }
  }

  getSession(callId: string): ConversationContext | undefined {
    return this.activeSessions.get(callId);
  }

  clearSession(callId: string): void {
    this.activeSessions.delete(callId);
  }
}

export const conversationManager = new ConversationManager();
