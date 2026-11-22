import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider } from './LLMProvider';
import type {
  ConversationContext,
  StructuredTurnResponse,
  CallSummaryResult,
  LLMUsageStats,
} from './types';
import { buildSystemPrompt, buildUserMessage } from './prompt-builder';
import { validateAndRepairTurnResponse } from './response-schema';
import { detectDncRequest, sanitizeProspectUtterance, validateResponseSafety } from './safety-rules';
import { getServerEnv } from '@/lib/env';

export class AnthropicLLMProvider implements ILLMProvider {
  readonly providerName = 'anthropic_claude';
  private client: Anthropic | null = null;

  private get apiKey(): string | undefined {
    try {
      const env = getServerEnv();
      const key = env.ANTHROPIC_API_KEY;
      if (key && !key.includes('mock_anthropic') && !key.includes('sk-ant-xxx')) {
        return key;
      }
    } catch {
      // Browser or unconfigured env
    }
    return undefined;
  }

  private get model(): string {
    try {
      const env = getServerEnv();
      return env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    } catch {
      return 'claude-3-5-sonnet-20241022';
    }
  }

  private getAnthropicClient(): Anthropic | null {
    if (this.client) return this.client;
    const key = this.apiKey;
    if (key) {
      this.client = new Anthropic({ apiKey: key });
      return this.client;
    }
    return null;
  }

  /**
   * Generates a validated structured conversation turn response
   */
  async generateTurnResponse(
    context: ConversationContext,
    latestUtterance: string,
    abortSignal?: AbortSignal
  ): Promise<{ response: StructuredTurnResponse; stats: LLMUsageStats }> {
    const startTime = Date.now();

    // 1. Deterministic DNC safety check
    const dncCheck = detectDncRequest(latestUtterance);
    if (dncCheck.isDnc) {
      const response: StructuredTurnResponse = {
        spokenResponse:
          'Understood. I have added your number to our Do-Not-Call list and we will not contact you again. Have a good day.',
        stage: 'completed',
        intent: 'dnc_request',
        extractedFacts: {},
        qualificationUpdates: { interestLevel: 'none' },
        objection: 'privacy_or_dnc',
        nextAction: 'mark_dnc_and_terminate',
        shouldEndCall: true,
        shouldHandoff: false,
        handoffReason: null,
        shouldScheduleCallback: false,
        callbackDetails: null,
        dncDetected: true,
        dncReason: dncCheck.reason,
        confidence: 1.0,
      };

      return {
        response,
        stats: {
          inputTokens: 0,
          outputTokens: 0,
          totalCostEstimate: 0,
          latencyMs: Date.now() - startTime,
          model: this.model,
        },
      };
    }

    // 2. Prompt injection defense and input sanitization
    const { sanitized, hasInjectionAttempt } = sanitizeProspectUtterance(latestUtterance);

    const client = this.getAnthropicClient();

    // 3. Live Anthropic API Call
    if (client) {
      try {
        const systemPrompt = buildSystemPrompt(context);
        const userContent = buildUserMessage(context, sanitized);

        const message = await client.messages.create(
          {
            model: this.model,
            max_tokens: 600,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
          },
          { signal: abortSignal }
        );

        const rawText = message.content[0]?.type === 'text' ? message.content[0].text : '';
        const validated = validateAndRepairTurnResponse(rawText);

        // Safety verification on spoken text
        const safety = validateResponseSafety(validated.spokenResponse);
        if (!safety.isSafe) {
          validated.spokenResponse =
            'Let me confirm those exact details with our operations team, and we will follow up with you directly.';
          validated.shouldHandoff = true;
          validated.handoffReason = 'pricing_negotiation';
        }

        return {
          response: validated,
          stats: {
            inputTokens: message.usage?.input_tokens || 0,
            outputTokens: message.usage?.output_tokens || 0,
            totalCostEstimate:
              ((message.usage?.input_tokens || 0) * 0.003 + (message.usage?.output_tokens || 0) * 0.015) / 1000,
            latencyMs: Date.now() - startTime,
            model: this.model,
          },
        };
      } catch (err: unknown) {
        if (abortSignal?.aborted) {
          throw err;
        }
        if (getServerEnv().RM_PROVIDER_MODE === 'live') {
          throw new Error(
            `[Anthropic Claude Live Mode Error] Live Claude generation failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        console.warn('[AnthropicLLMProvider] Live API failed, using fallback engine', err);
      }
    } else {
      if (getServerEnv().RM_PROVIDER_MODE === 'live') {
        throw new Error(
          '[Anthropic Claude Live Mode Error] ANTHROPIC_API_KEY is not configured. Silent synthetic responses are strictly disabled in live mode.'
        );
      }
    }

    // 4. Synthetic Rule-Based Dialogue Engine for Local / Offline Verification
    return this.generateSyntheticResponse(context, sanitized, hasInjectionAttempt, startTime);
  }

  /**
   * Generates post-call summary and qualification notes
   */
  async generateCallSummary(context: ConversationContext): Promise<CallSummaryResult> {
    const client = this.getAnthropicClient();
    const transcriptText = context.turns
      .map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`)
      .join('\n');

    if (client && transcriptText.length > 0) {
      try {
        const prompt = `Summarize this outbound phone call for CRM records in structured JSON:
Company: ${context.lead.company}
Contact: ${context.lead.name} (${context.lead.jobTitle || 'Decision Maker'})
Campaign: ${context.campaign.name}

Transcript:
${transcriptText}

Output JSON format:
{
  "summary": "Brief paragraph summarizing conversation outcome",
  "keyFacts": ["Fact 1", "Fact 2"],
  "qualification": ${JSON.stringify(context.qualification)},
  "objections": ["Any objections raised"],
  "outcome": "qualified" | "interested" | "callback" | "appointment" | "not_interested" | "wrong_contact" | "dnc",
  "nextAction": "Actionable next step",
  "handoffRequired": boolean,
  "leadNote": "Concise CRM note"
}`;

        const message = await client.messages.create({
          model: this.model,
          max_tokens: 500,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
        });

        const raw = message.content[0]?.type === 'text' ? message.content[0].text : '';
        const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(clean);

        return {
          summary: parsed.summary || 'Call completed with prospect.',
          keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
          qualification: context.qualification,
          objections: Array.isArray(parsed.objections) ? parsed.objections : [],
          outcome: parsed.outcome || 'completed',
          nextAction: parsed.nextAction || 'Follow up as requested',
          handoffRequired: Boolean(parsed.handoffRequired),
          leadNote: parsed.leadNote || `Spoke with ${context.lead.name}.`,
        };
      } catch (err) {
        if (getServerEnv().RM_PROVIDER_MODE === 'live') {
          throw new Error(
            `[Anthropic Claude Live Mode Error] Live Claude summary generation failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    } else {
      if (getServerEnv().RM_PROVIDER_MODE === 'live') {
        throw new Error(
          '[Anthropic Claude Live Mode Error] ANTHROPIC_API_KEY is not configured for live summary generation.'
        );
      }
    }

    // Default Synthetic Summary
    const factsList = Object.entries(context.capturedFacts).map(([k, v]) => `${k}: ${v}`);
    const summaryOutcome = context.qualification.interestLevel === 'high' ? 'qualified' : 'interested';

    return {
      summary: `Outbound discussion with ${context.lead.name} at ${context.lead.company}. Covered operational requirements and qualification criteria.`,
      keyFacts: factsList.length > 0 ? factsList : ['Discussion completed', 'Contact confirmed'],
      qualification: context.qualification,
      objections: [],
      outcome: summaryOutcome,
      nextAction: 'Schedule follow-up review with account executive',
      handoffRequired: Boolean(context.qualification.humanHandoffRequired),
      leadNote: `Spoke with ${context.lead.name} (${context.lead.jobTitle || 'Contact'}) at ${context.lead.company}. Expressed ${context.qualification.interestLevel || 'medium'} interest. Lead details logged.`,
    };
  }

  async getHealth(): Promise<{ status: 'connected' | 'degraded' | 'disconnected' | 'testing'; model: string }> {
    const isConfigured = Boolean(this.apiKey);
    return {
      status: isConfigured ? 'connected' : 'testing',
      model: this.model,
    };
  }

  /**
   * Helper generating realistic structured responses for local offline verification
   */
  private generateSyntheticResponse(
    context: ConversationContext,
    utterance: string,
    hasInjectionAttempt: boolean,
    startTime: number
  ): { response: StructuredTurnResponse; stats: LLMUsageStats } {
    const lower = utterance.toLowerCase();
    const leadName = context.lead.name || 'there';
    const company = context.lead.company || 'your facility';

    let response: StructuredTurnResponse;

    if (hasInjectionAttempt) {
      response = {
        spokenResponse:
          "I'm focusing strictly on our materials review today. Could you tell me who handles surplus logistics at your location?",
        stage: 'discovery',
        intent: 'injection_deflected',
        extractedFacts: {},
        qualificationUpdates: {},
        objection: null,
        nextAction: 're_engage_decision_maker',
        shouldEndCall: false,
        shouldHandoff: false,
        handoffReason: null,
        shouldScheduleCallback: false,
        callbackDetails: null,
        dncDetected: false,
        dncReason: null,
        confidence: 0.9,
      };
    } else if (
      lower.includes('ton') ||
      lower.includes('scrap') ||
      lower.includes('material') ||
      lower.includes('aluminium') ||
      lower.includes('steel') ||
      lower.includes('copper') ||
      lower.includes('metal')
    ) {
      response = {
        spokenResponse:
          'Understood. We frequently handle that volume and material. Would you like our specialist to review collection options with you this week?',
        stage: 'qualification',
        intent: 'material_volume_identified',
        extractedFacts: { material: utterance.slice(0, 100) },
        qualificationUpdates: {
          materialAvailable: true,
          materialType: lower.includes('aluminium')
            ? 'Aluminium'
            : lower.includes('copper')
              ? 'Copper'
              : lower.includes('steel')
                ? 'Stainless Steel'
                : 'Industrial Scrap',
          estimatedVolume: 10,
          volumeUnit: 'tonnes',
          interestLevel: 'high',
        },
        objection: null,
        nextAction: 'schedule_specialist_review',
        shouldEndCall: false,
        shouldHandoff: false,
        handoffReason: null,
        shouldScheduleCallback: false,
        callbackDetails: null,
        dncDetected: false,
        dncReason: null,
        confidence: 0.95,
      };
    } else if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
      response = {
        spokenResponse:
          'Our pricing is determined by volume and material grade. I can have our commercial specialist prepare an exact estimate for you.',
        stage: 'objection',
        intent: 'pricing_inquiry',
        extractedFacts: { pricingRequested: true },
        qualificationUpdates: { humanHandoffRequired: true },
        objection: 'price_question',
        nextAction: 'handoff_to_commercial_rep',
        shouldEndCall: false,
        shouldHandoff: true,
        handoffReason: 'pricing_negotiation',
        shouldScheduleCallback: true,
        callbackDetails: { reason: 'Provide custom pricing quote' },
        dncDetected: false,
        dncReason: null,
        confidence: 0.95,
      };
    } else if (lower.includes('busy') || lower.includes('call back') || lower.includes('later')) {
      response = {
        spokenResponse:
          'No problem at all. When would be a convenient time for me to call you back?',
        stage: 'follow_up',
        intent: 'callback_request',
        extractedFacts: { requestedCallback: true },
        qualificationUpdates: { callbackRequested: true },
        objection: 'too_busy',
        nextAction: 'capture_callback_time',
        shouldEndCall: false,
        shouldHandoff: false,
        handoffReason: null,
        shouldScheduleCallback: true,
        callbackDetails: { reason: 'Prospect requested callback due to schedule' },
        dncDetected: false,
        dncReason: null,
        confidence: 0.95,
      };
    } else if (lower.includes('already have') || lower.includes('supplier') || lower.includes('vendor')) {
      response = {
        spokenResponse:
          'That makes sense. Many of our clients have existing suppliers as well. May I ask what volume you typically generate monthly?',
        stage: 'discovery',
        intent: 'competitor_objection',
        extractedFacts: { existingSupplier: true },
        qualificationUpdates: { currentSupplierOrBuyer: 'Existing vendor' },
        objection: 'already_have_supplier',
        nextAction: 'qualify_volume_and_contract_term',
        shouldEndCall: false,
        shouldHandoff: false,
        handoffReason: null,
        shouldScheduleCallback: false,
        callbackDetails: null,
        dncDetected: false,
        dncReason: null,
        confidence: 0.92,
      };
    } else {
      // Default natural discovery response
      response = {
        spokenResponse: `Thanks ${leadName}. We specialize in optimizing material recovery and logistics for teams like ${company}. Do you currently handle surplus recycling on-site?`,
        stage: 'qualification',
        intent: 'qualification_discovery',
        extractedFacts: { leadEngaged: true },
        qualificationUpdates: {
          decisionMakerIdentified: true,
          decisionMakerName: context.lead.name,
          interestLevel: 'medium',
        },
        objection: null,
        nextAction: 'discover_material_types',
        shouldEndCall: false,
        shouldHandoff: false,
        handoffReason: null,
        shouldScheduleCallback: false,
        callbackDetails: null,
        dncDetected: false,
        dncReason: null,
        confidence: 0.95,
      };
    }

    return {
      response,
      stats: {
        inputTokens: 250,
        outputTokens: 85,
        totalCostEstimate: 0.002,
        latencyMs: Date.now() - startTime,
        model: this.model,
      },
    };
  }
}

export const anthropicLLMProvider = new AnthropicLLMProvider();
