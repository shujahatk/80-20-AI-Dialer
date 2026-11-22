import { z } from 'zod';
import { sanitizeProspectUtterance } from '@/services/ai/safety-rules';
import {
  QUALIFICATION_STATUSES,
  SENDABLE_STATUSES,
  emptyQualification,
  type FollowUpCall,
  type QualificationResult,
  type QualificationStatus,
  type TranscriptTurn,
} from './types';

const STOP_ALL_PATTERNS = [
  /do not contact/i,
  /don't contact/i,
  /do not email/i,
  /don't email/i,
  /stop emailing/i,
  /unsubscribe/i,
  /never contact/i,
  /stop all (contact|communication)/i,
  /remove me from (your|the) (list|emails|mailing)/i,
];

const NOT_INTERESTED_PATTERNS = [/\bnot interested\b/i, /\bno thanks\b/i, /\bnot for us\b/i];

const qualificationSchema = z.object({
  status: z.enum(QUALIFICATION_STATUSES),
  interestLevel: z.enum(['none', 'low', 'medium', 'high', 'unknown']),
  customerRequirements: z.array(z.string().max(240)).max(8),
  mainObjections: z.array(z.string().max(240)).max(8),
  requestedInformation: z.array(z.string().max(240)).max(8),
  nextRecommendedAction: z.string().max(300),
  emailFollowUpEligible: z.boolean(),
  evidence: z
    .array(
      z.object({
        quote: z.string().min(1).max(400),
        speaker: z.enum(['ai', 'lead', 'operator', 'system']),
      })
    )
    .max(6),
});

export interface ClaudeJsonClient {
  completeJson(system: string, user: string): Promise<string>;
}

export class ClaudeUnavailableError extends Error {
  constructor() {
    super('Claude is unavailable');
    this.name = 'ClaudeUnavailableError';
  }
}

export class ClaudeResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeResponseError';
  }
}

function leadSpeech(transcript: TranscriptTurn[]): string {
  return transcript
    .filter((turn) => turn.speaker === 'lead')
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .join(' ');
}

function quoteFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function grounded(quote: string, transcript: string): boolean {
  const needle = quote.toLowerCase().replace(/\s+/g, ' ').trim();
  if (needle.length < 8) return false;
  return transcript.toLowerCase().replace(/\s+/g, ' ').includes(needle);
}

export function transcriptText(transcript: TranscriptTurn[]): string {
  return transcript.map((turn) => turn.text).join('\n');
}

export function classifyDeterministically(call: FollowUpCall): QualificationResult | null {
  const speech = leadSpeech(call.transcript);
  const matched = call.transcript.find((turn) => turn.speaker === 'lead' && turn.text.trim().length > 0);
  const evidence = matched ? [{ quote: quoteFrom(matched.text), speaker: 'lead' as const }] : [];

  if (STOP_ALL_PATTERNS.some((pattern) => pattern.test(speech))) {
    return {
      ...emptyQualification('DO_NOT_CONTACT', 'Suppress email and phone contact.'),
      interestLevel: 'none',
      evidence,
      insufficientEvidence: evidence.length === 0,
      mainObjections: ['The customer asked for no further contact.'],
    };
  }

  if (NOT_INTERESTED_PATTERNS.some((pattern) => pattern.test(speech))) {
    return {
      ...emptyQualification('NOT_INTERESTED', 'Do not send a follow-up email.'),
      interestLevel: 'none',
      evidence,
      insufficientEvidence: evidence.length === 0,
      mainObjections: ['The customer said they are not interested.'],
    };
  }

  const reason = (call.disconnectionReason || '').toLowerCase();
  const noConversation = speech.length < 12;
  const noAnswer =
    call.callStatus === 'no_answer' || reason.includes('no_answer') || reason.includes('voicemail') || reason.includes('machine');
  const unreachable =
    call.callStatus === 'busy' ||
    call.callStatus === 'failed' ||
    call.callStatus === 'cancelled' ||
    reason.includes('busy') ||
    reason.includes('failed') ||
    reason.includes('invalid') ||
    reason.includes('unreachable');

  if (noConversation && noAnswer) {
    return emptyQualification('NO_ANSWER', 'Do not send an email. The call was not answered.');
  }
  if (noConversation && unreachable) {
    return emptyQualification('UNREACHABLE', 'Do not send an email. The lead was not reached.');
  }
  if (noConversation) {
    return emptyQualification(
      'REVIEW_REQUIRED',
      'Do not send an email. The transcript is missing or too thin to support a follow-up.'
    );
  }

  return null;
}

export function buildQualificationPrompt(): string {
  return [
    'ROLE: qualification',
    'You qualify a completed RM AI Dialer sales call for a possible follow-up email.',
    'Return only JSON. Use only facts present in the transcript.',
    'Never invent statements, requirements, objections, meetings, or promises.',
    'If the transcript is missing, unclear, contradictory, or insufficient, set status to REVIEW_REQUIRED, emailFollowUpEligible to false, and insufficientEvidence to true.',
    'Evidence quotes must be copied from the transcript.',
    'emailFollowUpEligible may be true only for QUALIFIED, INTERESTED, or FOLLOW_UP_REQUIRED when a concrete customer request or agreed next step is present.',
    'A telephone do-not-call request is not an email opt-out. An explicit request to stop all contact is DO_NOT_CONTACT.',
    'Allowed statuses: QUALIFIED, INTERESTED, FOLLOW_UP_REQUIRED, NOT_INTERESTED, NO_ANSWER, UNREACHABLE, DO_NOT_CONTACT, REVIEW_REQUIRED.',
  ].join('\n');
}

export function buildQualificationUserMessage(call: FollowUpCall): string {
  const turns = call.transcript.map((turn) => {
    const text = turn.speaker === 'lead' ? sanitizeProspectUtterance(turn.text).sanitized : turn.text;
    return { speaker: turn.speaker, text: text.slice(0, 800) };
  });
  const clipped = JSON.stringify(turns).slice(0, 8000);
  return JSON.stringify({
    lead: call.lead
      ? { firstName: call.lead.firstName, companyName: call.lead.companyName, country: call.lead.country }
      : null,
    campaign: call.campaign?.name ?? null,
    callStatus: call.callStatus,
    disconnectionReason: call.disconnectionReason,
    transcript: clipped,
  });
}

export function parseQualification(raw: string, call: FollowUpCall): QualificationResult {
  const jsonText = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ClaudeResponseError('Claude qualification was not valid JSON.');
  }
  const result = qualificationSchema.safeParse(parsed);
  if (!result.success) {
    throw new ClaudeResponseError('Claude qualification did not match the required schema.');
  }

  const transcript = transcriptText(call.transcript);
  const evidence = result.data.evidence.filter((item) => grounded(item.quote, transcript));
  const sendable = SENDABLE_STATUSES.includes(result.data.status as QualificationStatus);
  if (!sendable || evidence.length === 0 || result.data.emailFollowUpEligible !== true) {
    if (!sendable) {
      return {
        ...result.data,
        status: result.data.status,
        emailFollowUpEligible: false,
        evidence,
        insufficientEvidence: evidence.length === 0,
      };
    }
    return emptyQualification(
      'REVIEW_REQUIRED',
      'Do not send an email. The qualification was not supported by the transcript.'
    );
  }

  return {
    ...result.data,
    evidence,
    emailFollowUpEligible: true,
    insufficientEvidence: false,
  };
}

export async function qualifyCall(call: FollowUpCall, claude: ClaudeJsonClient): Promise<QualificationResult> {
  const predetermined = classifyDeterministically(call);
  if (predetermined) return predetermined;

  let raw: string;
  try {
    raw = await claude.completeJson(buildQualificationPrompt(), buildQualificationUserMessage(call));
  } catch (error) {
    if (error instanceof ClaudeUnavailableError || error instanceof ClaudeResponseError) throw error;
    throw new ClaudeUnavailableError();
  }
  return parseQualification(raw, call);
}
