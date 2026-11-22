import { z } from 'zod';
import type { StructuredTurnResponse } from './types';

export const structuredTurnResponseSchema = z.object({
  spokenResponse: z
    .string()
    .min(1, 'Spoken response cannot be empty')
    .max(500, 'Spoken response should remain concise for phone audio (under 500 characters)'),
  stage: z.enum([
    'opening',
    'gatekeeper',
    'decision_maker',
    'discovery',
    'qualification',
    'objection',
    'follow_up',
    'handoff',
    'closing',
    'completed',
  ]),
  intent: z.string().default('conversational_reply'),
  extractedFacts: z.record(z.string(), z.unknown()).default({}),
  qualificationUpdates: z
    .object({
      decisionMakerIdentified: z.boolean().nullable().optional(),
      decisionMakerName: z.string().nullable().optional(),
      decisionMakerRole: z.string().nullable().optional(),
      materialAvailable: z.boolean().nullable().optional(),
      materialType: z.string().nullable().optional(),
      materialDescription: z.string().nullable().optional(),
      estimatedVolume: z.number().nullable().optional(),
      volumeUnit: z.string().nullable().optional(),
      frequency: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      timing: z.string().nullable().optional(),
      currentDisposalProcess: z.string().nullable().optional(),
      currentSupplierOrBuyer: z.string().nullable().optional(),
      interestLevel: z.enum(['high', 'medium', 'low', 'none']).nullable().optional(),
      callbackRequested: z.boolean().optional(),
      callbackTime: z.string().nullable().optional(),
      appointmentRequested: z.boolean().optional(),
      emailRequested: z.boolean().optional(),
      humanHandoffRequired: z.boolean().optional(),
    })
    .default({}),
  objection: z
    .enum([
      'not_interested',
      'already_have_supplier',
      'send_email',
      'too_busy',
      'call_back',
      'wrong_person',
      'price_question',
      'logistics_question',
      'what_is_this_about',
      'privacy_or_dnc',
      'other',
    ])
    .nullable()
    .default(null),
  nextAction: z.string().default('continue_dialogue'),
  shouldEndCall: z.boolean().default(false),
  shouldHandoff: z.boolean().default(false),
  handoffReason: z
    .enum([
      'pricing_negotiation',
      'purchase_authorization',
      'logistics_commitment',
      'high_value_lead',
      'prospect_requested_human',
      'ai_uncertainty',
      'compliance_question',
      'appointment_human_confirmation',
    ])
    .nullable()
    .default(null),
  shouldScheduleCallback: z.boolean().default(false),
  callbackDetails: z
    .object({
      date: z.string().optional(),
      time: z.string().optional(),
      timezone: z.string().optional(),
      contact: z.string().optional(),
      reason: z.string().optional(),
    })
    .nullable()
    .default(null),
  dncDetected: z.boolean().default(false),
  dncReason: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.95),
});

export const callSummarySchema = z.object({
  summary: z.string().min(1),
  keyFacts: z.array(z.string()).default([]),
  qualification: z.record(z.string(), z.unknown()).default({}),
  objections: z.array(z.string()).default([]),
  outcome: z.string().default('completed'),
  nextAction: z.string().default('follow_up'),
  handoffRequired: z.boolean().default(false),
  leadNote: z.string().min(1),
});

/**
 * Validates and repairs raw LLM JSON output into strict StructuredTurnResponse
 */
export function validateAndRepairTurnResponse(raw: unknown): StructuredTurnResponse {
  // If raw is already an object, attempt direct parse
  if (typeof raw === 'object' && raw !== null) {
    const parsed = structuredTurnResponseSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data as StructuredTurnResponse;
    }
  }

  // If raw is a string, try JSON parse
  if (typeof raw === 'string') {
    try {
      // Strip markdown code block fences if present
      const cleanJson = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsedObj = JSON.parse(cleanJson);
      const parsed = structuredTurnResponseSchema.safeParse(parsedObj);
      if (parsed.success) {
        return parsed.data as StructuredTurnResponse;
      }
    } catch {
      // Fallback below
    }
  }

  // Safe fallback if structure cannot be parsed
  const fallbackSpoken =
    typeof raw === 'string' && raw.length > 0 && raw.length < 300
      ? raw
      : 'Thank you for sharing that. Let me make sure I have all the details noted for our team.';

  return {
    spokenResponse: fallbackSpoken,
    stage: 'discovery',
    intent: 'general_inquiry',
    extractedFacts: {},
    qualificationUpdates: {},
    objection: null,
    nextAction: 'continue_dialogue',
    shouldEndCall: false,
    shouldHandoff: false,
    handoffReason: null,
    shouldScheduleCallback: false,
    callbackDetails: null,
    dncDetected: false,
    dncReason: null,
    confidence: 0.8,
  };
}
