/**
 * RM AI DIALER — CLAUDE CRM INTELLIGENCE BRAIN
 * Central LLM service powering post-call analysis, structured commercial extraction,
 * campaign desired-outcome evaluation, qualification decisions, callback detection,
 * and personalized qualified-lead email drafting.
 *
 * Strictly server-side. Never expose ANTHROPIC_API_KEY to the browser.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import type { LeadStatusDb } from '@/lib/supabase/types';
import {
  evaluateCampaignPostCallQualification,
  type CampaignQualificationCriteria,
  type CampaignQualificationEvaluation,
  type CanonicalQualificationOutcome,
} from '@/services/campaigns/campaign-qualification.service';
import { sanitizeProspectUtterance } from './safety-rules';

export const BUSINESS_QUALIFICATION_STATUSES = [
  'QUALIFIED',
  'NOT_QUALIFIED',
  'NEEDS_REVIEW',
  'FOLLOW_UP_REQUIRED',
  'CALLBACK_REQUESTED',
  'INTERESTED',
  'NOT_INTERESTED',
  'DO_NOT_CALL',
] as const;

export type BusinessQualificationStatus = (typeof BUSINESS_QUALIFICATION_STATUSES)[number];

export const TECHNICAL_CALL_STATUSES = [
  'COMPLETED',
  'NO_ANSWER',
  'BUSY',
  'VOICEMAIL',
  'FAILED',
] as const;

export type TechnicalCallStatus = (typeof TECHNICAL_CALL_STATUSES)[number];

/**
 * Strict Zod schema for validating Claude's structured CRM analysis output
 * before any database update is permitted.
 */
export const claudeCrmAnalysisSchema = z.object({
  contactName: z.string().nullable().default(null),
  companyName: z.string().nullable().default(null),
  phoneNumber: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  jobTitle: z.string().nullable().default(null),
  decisionMakerStatus: z
    .enum(['confirmed', 'unconfirmed', 'not_decision_maker', 'unknown'])
    .default('unknown'),
  decisionMakerIdentified: z.boolean().default(false),
  materialOrProduct: z.string().nullable().default(null),
  estimatedVolume: z.string().nullable().default(null),
  materialGrade: z.string().nullable().default(null),
  frequency: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  timeline: z.string().nullable().default(null),
  interestLevel: z.enum(['high', 'medium', 'low', 'none', 'unknown']).default('unknown'),
  objections: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  nextSteps: z.string().nullable().default(null),
  callbackRequested: z.boolean().default(false),
  callbackDateTime: z.string().nullable().default(null),
  followUpDate: z.string().nullable().default(null),
  dncRequested: z.boolean().default(false),
  desiredOutcomeAchieved: z.boolean().default(false),
  qualificationStatus: z.enum(BUSINESS_QUALIFICATION_STATUSES),
  technicalStatus: z.enum(TECHNICAL_CALL_STATUSES).default('COMPLETED'),
  qualificationReasoning: z.string().min(1),
  callSummary: z.string().min(1),
  evidenceQuotes: z.array(z.string()).default([]),
  recommendedPipelineStage: z
    .enum(['NEW', 'CONTACTED', 'ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION'])
    .default('CONTACTED'),
});

export type ClaudeCrmAnalysisResult = z.infer<typeof claudeCrmAnalysisSchema> & {
  analysisSource: 'claude_live' | 'deterministic_operational' | 'deterministic_fallback';
  modelUsed: string;
  processingStatus: 'completed' | 'fallback_completed' | 'operational_non_connected';
  analysisError?: string | null;
};

export const claudePersonalizedEmailSchema = z.object({
  subject: z.string().min(5).max(160),
  textBody: z.string().min(20).max(3000),
  htmlBody: z.string().optional().default(''),
});

export type ClaudePersonalizedEmailResult = z.infer<typeof claudePersonalizedEmailSchema>;

export interface ClaudeCompletionClient {
  completeJson(params: { system: string; user: string; maxTokens?: number }): Promise<string>;
}

const UNAUTHORIZED_COMMITMENT_PATTERNS = [
  /\bi (?:hereby )?(?:approve|confirm) your purchase\b/i,
  /\bdeal is closed\b/i,
  /\bcontract is signed\b/i,
  /\bwe guarantee collection on\b/i,
  /\bguaranteed price of \$/i,
  /\bbinding agreement\b/i,
];

export function containsUnauthorizedCommitment(text: string): boolean {
  return UNAUTHORIZED_COMMITMENT_PATTERNS.some((pattern) => pattern.test(text));
}

export interface AnalyzeCallWithClaudeInput {
  callId: string;
  retellCallId?: string | null;
  transcriptText?: string | null;
  transcriptTurns?: Array<{ speaker: string; text: string }>;
  retellSummary?: string | null;
  retellCustomData?: Record<string, unknown> | null;
  retellCallOutcome?: string | null;
  retellLeadStatus?: string | null;
  retellSentiment?: string | null;
  retellInVoicemail?: boolean | null;
  disconnectionReason?: string | null;
  durationSeconds?: number | null;
  callStatus?: string | null;
  leadContext?: {
    id?: string;
    name?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
    title?: string | null;
    city?: string | null;
    product?: string | null;
  } | null;
  campaignContext?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    desiredOutcome?: string | null;
    qualificationCriteria?: CampaignQualificationCriteria | null;
    requiredCommercialInfo?: string[] | null;
  } | null;
}

export class ClaudeCrmIntelligenceService {
  private customClient: ClaudeCompletionClient | null;

  constructor(customClient?: ClaudeCompletionClient | null) {
    this.customClient = customClient ?? null;
  }

  private get model(): string {
    try {
      const env = getServerEnv();
      return env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    } catch {
      return 'claude-sonnet-4-6';
    }
  }

  private getCompletionClient(): ClaudeCompletionClient | null {
    if (this.customClient) return this.customClient;

    try {
      const env = getServerEnv();
      const key = env.ANTHROPIC_API_KEY;
      if (!key || key.includes('mock_anthropic') || key.includes('sk-ant-xxx')) {
        return null;
      }
      const anthropic = new Anthropic({ apiKey: key });
      const model = this.model;
      return {
        async completeJson({ system, user, maxTokens = 1200 }) {
          const msg = await anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            temperature: 0,
            system,
            messages: [{ role: 'user', content: user }],
          });
          const block = msg.content.find((b) => b.type === 'text');
          if (!block || block.type !== 'text' || !block.text.trim()) {
            throw new Error('Claude returned an empty response');
          }
          return block.text;
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Determines the technical call status from disconnection reason and call status.
   */
  public resolveTechnicalStatus(input: AnalyzeCallWithClaudeInput): TechnicalCallStatus {
    const disconn = (input.disconnectionReason || '').toLowerCase();
    const status = (input.callStatus || '').toLowerCase();
    const outcome = (input.retellCallOutcome || '').toUpperCase();

    if (input.retellInVoicemail || disconn.includes('voicemail') || disconn.includes('machine') || outcome === 'VOICEMAIL') {
      return 'VOICEMAIL';
    }
    if (disconn.includes('busy') || status === 'busy' || outcome === 'BUSY') {
      return 'BUSY';
    }
    if (disconn.includes('no_answer') || disconn.includes('timeout') || status === 'no_answer' || outcome === 'NO_ANSWER') {
      return 'NO_ANSWER';
    }
    if (disconn.includes('fail') || disconn.includes('error') || status === 'failed' || status === 'error' || outcome === 'FAILED') {
      return 'FAILED';
    }
    return 'COMPLETED';
  }

  /**
   * Checks whether an actual human conversation took place.
   */
  public hasActualConversation(input: AnalyzeCallWithClaudeInput, technicalStatus: TechnicalCallStatus): boolean {
    if (technicalStatus === 'NO_ANSWER' || technicalStatus === 'BUSY' || technicalStatus === 'FAILED') {
      return false;
    }

    const turns = input.transcriptTurns || [];
    const leadTurns = turns.filter((t) => {
      const s = t.speaker.toLowerCase();
      return (s === 'lead' || s === 'user' || s === 'prospect') && t.text.trim().length > 2;
    });

    const rawTranscript = (input.transcriptText || '').trim();
    const hasCustomData = Boolean(
      input.retellCustomData && Object.keys(input.retellCustomData).length > 0
    );
    const hasSummary = Boolean(input.retellSummary && input.retellSummary.trim().length > 10);

    if (technicalStatus === 'VOICEMAIL' && leadTurns.length === 0) {
      return false;
    }

    return leadTurns.length > 0 || rawTranscript.length > 15 || hasCustomData || hasSummary;
  }

  /**
   * Main entry point: Analyzes a completed Retell call using Claude as the CRM Intelligence Brain.
   * Converts the result into both ClaudeCrmAnalysisResult and CampaignQualificationEvaluation.
   */
  async analyzeCompletedCall(input: AnalyzeCallWithClaudeInput): Promise<{
    claudeAnalysis: ClaudeCrmAnalysisResult;
    qualificationEval: CampaignQualificationEvaluation;
  }> {
    const technicalStatus = this.resolveTechnicalStatus(input);
    const conversationOccurred = this.hasActualConversation(input, technicalStatus);

    // 1. Run deterministic evaluation as baseline / safety anchor
    const fullTranscript =
      input.transcriptText ||
      (input.transcriptTurns || []).map((t) => `${t.speaker}: ${t.text}`).join('\n') ||
      '';

    const customData = input.retellCustomData || {};
    const deterministicEval = evaluateCampaignPostCallQualification(
      {
        callOutcome: input.retellCallOutcome,
        leadStatus: input.retellLeadStatus,
        summary: input.retellSummary,
        sentiment: input.retellSentiment,
        dncRequested: Boolean(customData.dnc_requested || customData.do_not_call || input.retellCallOutcome === 'DO_NOT_CALL'),
        inVoicemail: Boolean(input.retellInVoicemail),
        disconnectionReason: input.disconnectionReason,
        decisionMakerIdentified:
          typeof customData.decision_maker_identified === 'boolean'
            ? customData.decision_maker_identified
            : typeof customData.decision_maker_confirmed === 'boolean'
              ? customData.decision_maker_confirmed
              : null,
        contactName: (customData.contact_name as string) || (customData.customer_name as string) || null,
        companyName: (customData.company_name as string) || (customData.company as string) || null,
        jobTitle: (customData.job_title as string) || (customData.title as string) || null,
        emailAddress: (customData.email_address as string) || (customData.email as string) || null,
        directPhoneNumber: (customData.direct_phone_number as string) || (customData.direct_phone as string) || null,
        interestLevel: (customData.interest_level as string) || null,
        materialInterest:
          (customData.material_interest as string) ||
          (customData.material_type as string) ||
          (customData.product as string) ||
          null,
        estimatedVolume:
          (customData.estimated_volume as string) ||
          (customData.volume as string) ||
          (customData.monthly_volume as string) ||
          null,
        materialGrade: (customData.material_grade as string) || (customData.grade as string) || null,
        purchaseIntent: (customData.purchase_intent as string) || (customData.timeline as string) || null,
        commercialRequirements:
          typeof customData.commercial_requirements === 'string'
            ? customData.commercial_requirements
            : Array.isArray(customData.commercial_requirements)
              ? customData.commercial_requirements.join('; ')
              : null,
        customerObjections:
          typeof customData.customer_objections === 'string'
            ? customData.customer_objections
            : Array.isArray(customData.customer_objections)
              ? customData.customer_objections.join('; ')
              : null,
        nextSteps: (customData.next_steps as string) || (customData.next_step as string) || null,
        callbackRequested: Boolean(customData.callback_requested || customData.callback_time),
        callbackTime: (customData.callback_time as string) || (customData.scheduled_callback as string) || null,
        followUpRequirements: (customData.follow_up_requirements as string) || null,
        customData,
        transcriptText: fullTranscript,
      },
      input.campaignContext?.qualificationCriteria
    );

    // 2. If no conversation happened, never fabricate transcript details or commercial information
    if (!conversationOccurred) {
      const nonConnectedAnalysis: ClaudeCrmAnalysisResult = {
        contactName: null,
        companyName: null,
        phoneNumber: null,
        email: null,
        jobTitle: null,
        decisionMakerStatus: 'unknown',
        decisionMakerIdentified: false,
        materialOrProduct: null,
        estimatedVolume: null,
        materialGrade: null,
        frequency: null,
        location: null,
        timeline: null,
        interestLevel: 'unknown',
        objections: [],
        requirements: [],
        nextSteps:
          technicalStatus === 'NO_ANSWER' || technicalStatus === 'BUSY'
            ? 'Automatic retry according to campaign retry schedule'
            : null,
        callbackRequested: false,
        callbackDateTime: null,
        followUpDate: null,
        dncRequested: false,
        desiredOutcomeAchieved: false,
        qualificationStatus: 'NOT_QUALIFIED',
        technicalStatus,
        qualificationReasoning: `No conversation occurred. Technical call outcome: ${technicalStatus}${
          input.disconnectionReason ? ` (${input.disconnectionReason})` : ''
        }.`,
        callSummary: deterministicEval.summary || `Call ended without conversation (${technicalStatus}).`,
        evidenceQuotes: [],
        recommendedPipelineStage: 'CONTACTED',
        analysisSource: 'deterministic_operational',
        modelUsed: 'operational_rule_engine',
        processingStatus: 'operational_non_connected',
      };

      return {
        claudeAnalysis: nonConnectedAnalysis,
        qualificationEval: deterministicEval,
      };
    }

    // 3. Invoke Claude LLM to analyze the transcript, Retell analysis, and campaign desired outcome
    const client = this.getCompletionClient();
    if (client) {
      let lastError: string | null = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const systemPrompt = this.buildAnalysisSystemPrompt(input);
          const userPrompt = this.buildAnalysisUserPrompt(input, fullTranscript, technicalStatus);
          const rawJson = await client.completeJson({
            system: systemPrompt,
            user: userPrompt,
            maxTokens: 1200,
          });

          const parsedAnalysis = this.parseAndValidateClaudeAnalysis(
            rawJson,
            input,
            technicalStatus,
            deterministicEval
          );

          const mergedEval = this.mergeClaudeIntoQualificationEval(
            parsedAnalysis,
            deterministicEval,
            input.campaignContext?.qualificationCriteria
          );

          return {
            claudeAnalysis: parsedAnalysis,
            qualificationEval: mergedEval,
          };
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 300 * attempt));
          }
        }
      }

      // Fallback safely if Claude timed out or returned invalid schema after retries
      const fallbackAnalysis = this.buildFallbackAnalysisFromDeterministic(
        deterministicEval,
        technicalStatus,
        input,
        lastError
      );
      return {
        claudeAnalysis: fallbackAnalysis,
        qualificationEval: deterministicEval,
      };
    }

    // 4. Offline / Mock / Unconfigured Anthropic Key -> Deterministic Intelligence Fallback
    const fallbackAnalysis = this.buildFallbackAnalysisFromDeterministic(
      deterministicEval,
      technicalStatus,
      input,
      null
    );
    return {
      claudeAnalysis: fallbackAnalysis,
      qualificationEval: deterministicEval,
    };
  }

  private buildAnalysisSystemPrompt(input: AnalyzeCallWithClaudeInput): string {
    const desiredOutcome =
      input.campaignContext?.desiredOutcome ||
      'Identify decision maker, confirm commercial interest in materials/products, and verify estimated volume and material grade.';

    const requiredInfo =
      input.campaignContext?.requiredCommercialInfo && input.campaignContext.requiredCommercialInfo.length > 0
        ? input.campaignContext.requiredCommercialInfo.join(', ')
        : 'decision maker status, material/product, estimated volume, material grade, timeline';

    return [
      'You are the central CRM Intelligence Brain for RM Group (RM 80/20 AI Dialer).',
      'Your task is to analyze a completed outbound Retell AI call transcript and structured telemetry, evaluate the campaign desired outcome, extract structured commercial facts, and make an authoritative qualification decision.',
      '',
      'STRICT RULES:',
      '1. Return ONLY valid JSON matching the required schema. Do not wrap in prose.',
      '2. Do NOT invent missing information. Use null for any unknown string field and [] for empty arrays.',
      '3. A connected call alone NEVER means QUALIFIED. Evaluate actual conversation evidence against the campaign desired outcome and required commercial criteria.',
      '4. Campaign Desired Outcome: ' + desiredOutcome,
      '5. Required Commercial Information: ' + requiredInfo,
      '6. If the prospect requested Do Not Call / stop calling, set dncRequested=true and qualificationStatus="DO_NOT_CALL".',
      '7. If the prospect requested a callback at a specific time or later, set callbackRequested=true, extract callbackDateTime if stated, and set qualificationStatus="CALLBACK_REQUESTED".',
      '8. If the campaign desired outcome is genuinely achieved with confirmed evidence (including decision-maker engagement, material/product interest, and volume/commercial details), set desiredOutcomeAchieved=true and qualificationStatus="QUALIFIED".',
      '9. If contact details were captured or partial interest was shown, but required commercial evidence (such as volume or material specification) is missing or ambiguous, set qualificationStatus="NEEDS_REVIEW" and desiredOutcomeAchieved=false.',
      '10. If the prospect explicitly declined or has no commercial need, set qualificationStatus="NOT_INTERESTED" or "NOT_QUALIFIED".',
      '11. Business restrictions: The AI assistant must never negotiate or agree on pricing, approve purchases, close deals, promise collections, or make contractual commitments.',
      '',
      'Required JSON Schema keys:',
      '{',
      '  "contactName": string | null,',
      '  "companyName": string | null,',
      '  "phoneNumber": string | null,',
      '  "email": string | null,',
      '  "jobTitle": string | null,',
      '  "decisionMakerStatus": "confirmed" | "unconfirmed" | "not_decision_maker" | "unknown",',
      '  "decisionMakerIdentified": boolean,',
      '  "materialOrProduct": string | null,',
      '  "estimatedVolume": string | null,',
      '  "materialGrade": string | null,',
      '  "frequency": string | null,',
      '  "location": string | null,',
      '  "timeline": string | null,',
      '  "interestLevel": "high" | "medium" | "low" | "none" | "unknown",',
      '  "objections": string[],',
      '  "requirements": string[],',
      '  "nextSteps": string | null,',
      '  "callbackRequested": boolean,',
      '  "callbackDateTime": string | null,',
      '  "followUpDate": string | null,',
      '  "dncRequested": boolean,',
      '  "desiredOutcomeAchieved": boolean,',
      '  "qualificationStatus": "QUALIFIED" | "NOT_QUALIFIED" | "NEEDS_REVIEW" | "FOLLOW_UP_REQUIRED" | "CALLBACK_REQUESTED" | "INTERESTED" | "NOT_INTERESTED" | "DO_NOT_CALL",',
      '  "technicalStatus": "COMPLETED" | "NO_ANSWER" | "BUSY" | "VOICEMAIL" | "FAILED",',
      '  "qualificationReasoning": string,',
      '  "callSummary": string,',
      '  "evidenceQuotes": string[],',
      '  "recommendedPipelineStage": "NEW" | "CONTACTED" | "ENGAGED" | "TECHNICAL_EVALUATION" | "COMMERCIAL_DISCUSSION"',
      '}',
    ].join('\n');
  }

  private buildAnalysisUserPrompt(
    input: AnalyzeCallWithClaudeInput,
    fullTranscript: string,
    technicalStatus: TechnicalCallStatus
  ): string {
    const sanitizedTranscript = sanitizeProspectUtterance(fullTranscript.slice(0, 10000)).sanitized;
    return JSON.stringify({
      callId: input.callId,
      retellCallId: input.retellCallId || null,
      technicalStatus,
      disconnectionReason: input.disconnectionReason || null,
      durationSeconds: input.durationSeconds ?? null,
      leadContext: input.leadContext || null,
      campaignContext: input.campaignContext || null,
      retellSummary: input.retellSummary || null,
      retellCallOutcome: input.retellCallOutcome || null,
      retellLeadStatus: input.retellLeadStatus || null,
      retellCustomData: input.retellCustomData || null,
      transcript: sanitizedTranscript,
    });
  }

  public parseAndValidateClaudeAnalysis(
    rawText: string,
    input: AnalyzeCallWithClaudeInput,
    technicalStatus: TechnicalCallStatus,
    deterministicEval: CampaignQualificationEvaluation
  ): ClaudeCrmAnalysisResult {
    const cleaned = rawText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let rawObj: unknown;
    try {
      rawObj = JSON.parse(cleaned);
    } catch {
      throw new Error('Claude analysis response was not valid JSON');
    }

    const parsed = claudeCrmAnalysisSchema.safeParse(rawObj);
    if (!parsed.success) {
      throw new Error(`Claude analysis failed schema validation: ${parsed.error.message}`);
    }

    const data = parsed.data;

    // Enforce hard safety invariants:
    // 1. Non-connected calls can never be marked QUALIFIED
    if (technicalStatus !== 'COMPLETED') {
      data.desiredOutcomeAchieved = false;
      if (data.qualificationStatus === 'QUALIFIED') {
        data.qualificationStatus = 'NOT_QUALIFIED';
      }
    }

    // 2. DNC request always takes precedence
    if (data.dncRequested || deterministicEval.outcome === 'DO_NOT_CALL') {
      data.dncRequested = true;
      data.desiredOutcomeAchieved = false;
      data.qualificationStatus = 'DO_NOT_CALL';
    }

    // 3. Callback request precedence over failure/generic status
    if ((data.callbackRequested || deterministicEval.callbackRequested) && data.qualificationStatus !== 'DO_NOT_CALL') {
      data.callbackRequested = true;
      data.callbackDateTime = data.callbackDateTime || deterministicEval.callbackTime || null;
      if (data.qualificationStatus !== 'QUALIFIED') {
        data.qualificationStatus = 'CALLBACK_REQUESTED';
      }
    }

    // 4. Enforce campaign criteria guardrails (contact details without required volume/material -> NEEDS_REVIEW)
    const criteria = input.campaignContext?.qualificationCriteria;
    const requireMat = criteria?.requireMaterialType ?? true;
    const requireVol = criteria?.requireVolume ?? true;
    const effectiveMaterial = data.materialOrProduct || deterministicEval.materialInterest;
    const effectiveVolume = data.estimatedVolume || deterministicEval.estimatedVolume;

    if (data.qualificationStatus === 'QUALIFIED') {
      if ((requireMat && !effectiveMaterial) || (requireVol && !effectiveVolume)) {
        data.qualificationStatus = 'NEEDS_REVIEW';
        data.desiredOutcomeAchieved = false;
        data.recommendedPipelineStage = 'ENGAGED';
        data.qualificationReasoning = `${data.qualificationReasoning} (Adjusted to NEEDS_REVIEW: required material or volume specification was not confirmed.)`;
      } else {
        data.desiredOutcomeAchieved = true;
        data.recommendedPipelineStage = 'TECHNICAL_EVALUATION';
      }
    }

    // 5. Business restriction check on summary / nextSteps
    if (containsUnauthorizedCommitment(data.callSummary)) {
      data.callSummary = deterministicEval.summary || 'Call completed and analyzed for commercial qualification.';
    }

    return {
      ...data,
      materialOrProduct: effectiveMaterial || null,
      estimatedVolume: effectiveVolume || null,
      materialGrade: data.materialGrade || deterministicEval.materialGrade || null,
      contactName: data.contactName || deterministicEval.contactName || null,
      companyName: data.companyName || deterministicEval.companyName || null,
      jobTitle: data.jobTitle || deterministicEval.jobTitle || null,
      email: data.email || deterministicEval.emailAddress || null,
      phoneNumber: data.phoneNumber || deterministicEval.directPhoneNumber || null,
      technicalStatus,
      analysisSource: 'claude_live',
      modelUsed: this.model,
      processingStatus: 'completed',
    };
  }

  private mergeClaudeIntoQualificationEval(
    claude: ClaudeCrmAnalysisResult,
    base: CampaignQualificationEvaluation,
    _criteria?: CampaignQualificationCriteria | null
  ): CampaignQualificationEvaluation {
    let outcome: CanonicalQualificationOutcome = claude.qualificationStatus;
    if (claude.technicalStatus !== 'COMPLETED' && claude.qualificationStatus !== 'DO_NOT_CALL') {
      outcome = claude.technicalStatus;
    }

    const isQualified = outcome === 'QUALIFIED';
    let recommendedDbStatus: LeadStatusDb = base.recommendedDbStatus;
    let recommendedDomainStatus = base.recommendedDomainStatus;

    if (outcome === 'DO_NOT_CALL') {
      recommendedDbStatus = 'dnc';
      recommendedDomainStatus = 'dnc';
    } else if (outcome === 'QUALIFIED') {
      recommendedDbStatus = 'TECHNICAL_EVALUATION';
      recommendedDomainStatus = 'qualified';
    } else if (outcome === 'NEEDS_REVIEW') {
      recommendedDbStatus = 'ENGAGED';
      recommendedDomainStatus = 'needs-review';
    } else if (outcome === 'CALLBACK_REQUESTED') {
      recommendedDbStatus = 'CONTACTED';
      recommendedDomainStatus = 'callback-scheduled';
    } else {
      recommendedDbStatus = 'CONTACTED';
      recommendedDomainStatus = 'contacted';
    }

    return {
      outcome,
      isQualified,
      decisionMakerInvolved: claude.decisionMakerIdentified || base.decisionMakerInvolved,
      contactName: claude.contactName || base.contactName,
      companyName: claude.companyName || base.companyName,
      jobTitle: claude.jobTitle || base.jobTitle,
      emailAddress: claude.email || base.emailAddress,
      directPhoneNumber: claude.phoneNumber || base.directPhoneNumber,
      materialInterest: claude.materialOrProduct || base.materialInterest,
      estimatedVolume: claude.estimatedVolume || base.estimatedVolume,
      materialGrade: claude.materialGrade || base.materialGrade,
      purchaseIntent: claude.timeline || claude.interestLevel || base.purchaseIntent,
      commercialRequirements:
        claude.requirements.length > 0 ? claude.requirements : base.commercialRequirements,
      customerObjections:
        claude.objections.length > 0 ? claude.objections : base.customerObjections,
      nextSteps: claude.nextSteps || base.nextSteps,
      callbackRequested: claude.callbackRequested || base.callbackRequested,
      callbackTime: claude.callbackDateTime || base.callbackTime,
      followUpRequirements: claude.followUpDate || base.followUpRequirements,
      disqualificationReasons: base.disqualificationReasons,
      evidence: claude.evidenceQuotes.length > 0 ? claude.evidenceQuotes : base.evidence,
      summary: claude.callSummary || base.summary,
      recommendedDbStatus,
      recommendedDomainStatus,
    };
  }

  private buildFallbackAnalysisFromDeterministic(
    evalResult: CampaignQualificationEvaluation,
    technicalStatus: TechnicalCallStatus,
    input: AnalyzeCallWithClaudeInput,
    errorMsg: string | null
  ): ClaudeCrmAnalysisResult {
    const customData = input.retellCustomData || {};
    const statusMap: Record<string, BusinessQualificationStatus> = {
      QUALIFIED: 'QUALIFIED',
      NOT_QUALIFIED: 'NOT_QUALIFIED',
      NEEDS_REVIEW: 'NEEDS_REVIEW',
      FOLLOW_UP_REQUIRED: 'FOLLOW_UP_REQUIRED',
      CALLBACK_REQUESTED: 'CALLBACK_REQUESTED',
      INTERESTED: 'INTERESTED',
      NOT_INTERESTED: 'NOT_INTERESTED',
      DO_NOT_CALL: 'DO_NOT_CALL',
      REJECTED: 'NOT_QUALIFIED',
      NO_ANSWER: 'NOT_QUALIFIED',
      BUSY: 'NOT_QUALIFIED',
      VOICEMAIL: 'NOT_QUALIFIED',
      FAILED: 'NOT_QUALIFIED',
      COMPLETED: 'NEEDS_REVIEW',
    };

    const qualificationStatus: BusinessQualificationStatus =
      statusMap[evalResult.outcome] || 'NEEDS_REVIEW';

    const pipelineStage: 'NEW' | 'CONTACTED' | 'ENGAGED' | 'TECHNICAL_EVALUATION' | 'COMMERCIAL_DISCUSSION' =
      evalResult.recommendedDbStatus === 'TECHNICAL_EVALUATION' ||
      evalResult.recommendedDbStatus === 'COMMERCIAL_DISCUSSION'
        ? evalResult.recommendedDbStatus
        : evalResult.recommendedDbStatus === 'ENGAGED'
          ? 'ENGAGED'
          : 'CONTACTED';

    return {
      contactName: evalResult.contactName,
      companyName: evalResult.companyName,
      phoneNumber: evalResult.directPhoneNumber,
      email: evalResult.emailAddress,
      jobTitle: evalResult.jobTitle,
      decisionMakerStatus: evalResult.decisionMakerInvolved ? 'confirmed' : 'unknown',
      decisionMakerIdentified: evalResult.decisionMakerInvolved,
      materialOrProduct: evalResult.materialInterest,
      estimatedVolume: evalResult.estimatedVolume,
      materialGrade: evalResult.materialGrade,
      frequency: (customData.frequency as string) || null,
      location: (customData.location as string) || input.leadContext?.city || null,
      timeline: evalResult.purchaseIntent !== 'unknown' ? evalResult.purchaseIntent : null,
      interestLevel:
        evalResult.isQualified
          ? 'high'
          : qualificationStatus === 'INTERESTED' || qualificationStatus === 'NEEDS_REVIEW'
            ? 'medium'
            : qualificationStatus === 'NOT_INTERESTED' || qualificationStatus === 'DO_NOT_CALL'
              ? 'none'
              : 'unknown',
      objections: evalResult.customerObjections,
      requirements: evalResult.commercialRequirements,
      nextSteps: evalResult.nextSteps,
      callbackRequested: evalResult.callbackRequested,
      callbackDateTime: evalResult.callbackTime,
      followUpDate: evalResult.followUpRequirements,
      dncRequested: qualificationStatus === 'DO_NOT_CALL',
      desiredOutcomeAchieved: evalResult.isQualified,
      qualificationStatus,
      technicalStatus,
      qualificationReasoning:
        evalResult.evidence.join(' ') ||
        evalResult.summary ||
        'Evaluated against campaign qualification criteria.',
      callSummary: evalResult.summary || 'Call analysis completed.',
      evidenceQuotes: evalResult.evidence,
      recommendedPipelineStage: pipelineStage,
      analysisSource: 'deterministic_fallback',
      modelUsed: this.model,
      processingStatus: 'fallback_completed',
      analysisError: errorMsg,
    };
  }

  /**
   * Generates a personalized qualification email for a QUALIFIED lead using the campaign's template.
   * Never fabricates facts, pricing, or commitments.
   */
  async generatePersonalizedQualificationEmail(params: {
    templateSubject?: string | null;
    templateBody?: string | null;
    lead: {
      name: string;
      company: string;
      email: string;
      city?: string | null;
    };
    campaignName: string;
    analysis: {
      materialOrProduct?: string | null;
      estimatedVolume?: string | null;
      materialGrade?: string | null;
      frequency?: string | null;
      location?: string | null;
      timeline?: string | null;
      requirements?: string[];
      nextSteps?: string | null;
      callSummary?: string | null;
    };
    senderName: string;
    companyBlurb?: string;
  }): Promise<ClaudePersonalizedEmailResult> {
    const contactName = params.lead.name || 'there';
    const companyName = params.lead.company || 'your team';
    const material =
      params.analysis.materialOrProduct ||
      (params.analysis.requirements && params.analysis.requirements[0]) ||
      'commercial materials';
    const volume = params.analysis.estimatedVolume || 'commercial volume';
    const grade = params.analysis.materialGrade || 'standard specification';
    const location = params.analysis.location || params.lead.city || '';
    const timeline = params.analysis.timeline || 'upcoming schedule';
    const nextSteps = params.analysis.nextSteps || 'our commercial team will review your requirements';

    const interpolate = (template: string) =>
      template
        .replace(/\{\{\s*(?:contact_name|name|first_name)\s*\}\}/gi, contactName)
        .replace(/\{\{\s*(?:company_name|company)\s*\}\}/gi, companyName)
        .replace(/\{\{\s*(?:material_interest|material|product)\s*\}\}/gi, material)
        .replace(/\{\{\s*(?:estimated_volume|volume)\s*\}\}/gi, volume)
        .replace(/\{\{\s*(?:material_grade|grade)\s*\}\}/gi, grade)
        .replace(/\{\{\s*(?:location|city)\s*\}\}/gi, location || companyName)
        .replace(/\{\{\s*(?:timeline|timeframe)\s*\}\}/gi, timeline)
        .replace(/\{\{\s*next_steps\s*\}\}/gi, nextSteps);

    const baseSubject = params.templateSubject?.trim()
      ? interpolate(params.templateSubject.trim())
      : `Next steps for ${companyName} — ${material}`;

    const baseBody = params.templateBody?.trim()
      ? interpolate(params.templateBody.trim())
      : [
          `Hi ${contactName},`,
          '',
          `Thank you for speaking with our representative today regarding ${companyName}'s requirements for ${material}${
            params.analysis.estimatedVolume ? ` (${params.analysis.estimatedVolume})` : ''
          }${params.analysis.materialGrade ? `, ${params.analysis.materialGrade}` : ''}.`,
          '',
          params.analysis.nextSteps
            ? `As discussed, our next step is: ${params.analysis.nextSteps}.`
            : 'Our commercial trading team is reviewing your specifications and will follow up promptly with tailored details.',
          '',
          'Please reply directly to this email if you would like to share any additional specifications.',
        ].join('\n');

    // If a custom campaign template with explicit subject and body is configured,
    // use the interpolated template or ask Claude to polish it while preserving facts
    const client = this.getCompletionClient();
    if (client && !params.templateBody?.trim()) {
      try {
        const raw = await client.completeJson({
          system: [
            'You draft a concise, professional B2B follow-up email for a QUALIFIED lead.',
            'Return ONLY JSON: { "subject": string, "textBody": string }.',
            'Use ONLY the verified lead and call analysis facts provided.',
            'Never invent pricing, discounts, binding commitments, or unverified claims.',
            'Do not include an unsubscribe link or signature block (the system appends those automatically).',
          ].join('\n'),
          user: JSON.stringify({
            recipientName: contactName,
            companyName,
            campaignName: params.campaignName,
            senderName: params.senderName,
            companyDescription: params.companyBlurb || '',
            verifiedFacts: params.analysis,
            referenceSubject: baseSubject,
            referenceBody: baseBody,
          }),
          maxTokens: 700,
        });

        const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
        const parsed = claudePersonalizedEmailSchema.safeParse(JSON.parse(cleaned));
        if (parsed.success && !containsUnauthorizedCommitment(parsed.data.textBody)) {
          return parsed.data;
        }
      } catch {
        // Fall back to deterministic interpolated template
      }
    }

    return {
      subject: baseSubject.slice(0, 120),
      textBody: baseBody,
      htmlBody: '',
    };
  }
}

export const claudeCrmIntelligenceService = new ClaudeCrmIntelligenceService();
