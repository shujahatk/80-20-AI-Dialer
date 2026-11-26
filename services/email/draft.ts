import { z } from 'zod';
import type { EmailCategory, EmailDraft, FollowUpCall, QualificationResult } from './types';
import { ClaudeResponseError, transcriptText, type ClaudeJsonClient } from './qualification';

const draftSchema = z.object({
  subject: z.string().min(8).max(120),
  textBody: z.string().min(20).max(1800),
  htmlBody: z.string().max(4000).optional().default(''),
  category: z.enum(['qualification_follow_up', 'requested_information', 'general_follow_up']),
  evidenceReferences: z.array(z.string().min(8).max(240)).max(4).optional().default([]),
});

const FORBIDDEN = [
  /i have booked/i,
  /meeting is confirmed/i,
  /your meeting is/i,
  /we guarantee/i,
  /you agreed to (buy|purchase|sign)/i,
  /you committed/i,
  /limited time offer/i,
  /act now/i,
  /\bfree\b/i,
  /!!!/,
];

export function expectedCategory(qualification: QualificationResult): EmailCategory {
  if (qualification.requestedInformation.length > 0) return 'requested_information';
  if (qualification.status === 'QUALIFIED') return 'qualification_follow_up';
  return 'general_follow_up';
}

export function buildDraftPrompt(): string {
  return [
    'ROLE: email_draft',
    'Write a concise professional follow-up email as JSON.',
    'Use only the transcript, the qualification, the approved company description, and the approved campaign instructions.',
    'Do not invent customer statements, meetings, prices, commitments, or business claims.',
    'Do not include sensitive transcript details, phone numbers, or a full transcript.',
    'Do not add promotional slogans or an unsubscribe link. The system adds the sender footer and opt-out.',
    'evidenceReferences must be short verbatim excerpts from the transcript.',
    'Fields: subject, textBody, htmlBody, category, evidenceReferences.',
  ].join('\n');
}

export function buildDraftUserMessage(
  call: FollowUpCall,
  qualification: QualificationResult,
  senderName: string,
  companyBlurb: string
): string {
  return JSON.stringify({
    senderName,
    approvedCompanyDescription: companyBlurb.slice(0, 800),
    approvedCampaignInstructions: (call.campaign?.instructions || '').slice(0, 800),
    category: expectedCategory(qualification),
    lead: call.lead
      ? { firstName: call.lead.firstName, lastName: call.lead.lastName, companyName: call.lead.companyName }
      : null,
    qualification: {
      status: qualification.status,
      interestLevel: qualification.interestLevel,
      customerRequirements: qualification.customerRequirements,
      mainObjections: qualification.mainObjections,
      requestedInformation: qualification.requestedInformation,
      nextRecommendedAction: qualification.nextRecommendedAction,
      evidence: qualification.evidence,
    },
    transcript: transcriptText(call.transcript).slice(0, 6000),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function appendFooter(text: string, html: string, senderName: string, unsubscribeUrl: string): { textBody: string; htmlBody: string } {
  const textBody = `${text.trim()}\n\n${senderName}\nIf you no longer want these emails, unsubscribe: ${unsubscribeUrl}`;
  const htmlBody = `${html}<p>${escapeHtml(senderName)}</p><p>If you no longer want these emails, <a href="${escapeHtml(unsubscribeUrl)}">unsubscribe</a>.</p>`;
  return { textBody, htmlBody };
}

export type ValidateDraftSuccess = { ok: true; draft: EmailDraft };
export type ValidateDraftFailure = { ok: false; reasons: string[] };
export type ValidateDraftResult = ValidateDraftSuccess | ValidateDraftFailure;

export function isDraftInvalid(result: ValidateDraftResult): result is ValidateDraftFailure {
  return !result.ok;
}

export function validateDraft(
  draft: EmailDraft,
  call: FollowUpCall,
  qualification: QualificationResult
): ValidateDraftResult {
  const reasons: string[] = [];
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, reasons: ['The draft did not match the required email schema.'] };
  }
  const value = parsed.data;
  if (value.subject.includes('\n') || value.category !== expectedCategory(qualification)) {
    reasons.push('The subject or email category is not valid for this qualification.');
  }
  const blob = `${value.subject}\n${value.textBody}`;
  if (FORBIDDEN.some((pattern) => pattern.test(blob))) {
    reasons.push('The draft contains an unsupported claim, promotion, or commitment.');
  }
  if (/<script/i.test(value.htmlBody) || /javascript:/i.test(value.htmlBody)) {
    reasons.push('The draft contains unsafe HTML.');
  }
  const isCampaignTemplate = Boolean(call.campaign?.emailSubject && call.campaign?.emailBody);
  if (!isCampaignTemplate) {
    if (value.evidenceReferences.length > 0) {
      const transcript = transcriptText(call.transcript).toLowerCase().replace(/\s+/g, ' ');
      const ungrounded = value.evidenceReferences.filter(
        (quote) => !transcript.includes(quote.toLowerCase().replace(/\s+/g, ' ').trim())
      );
      if (ungrounded.length > 0) {
        reasons.push('The draft cites conversation details that are not in the transcript.');
      }
    }
    const identity = `${call.lead?.firstName ?? ''} ${call.lead?.companyName ?? ''}`.toLowerCase();
    if (call.lead && !value.textBody.toLowerCase().includes(call.lead.firstName.toLowerCase()) && !value.textBody.toLowerCase().includes(call.lead.companyName.toLowerCase())) {
      reasons.push('The draft does not identify the recipient.');
    }
    if (!identity.trim()) {
      reasons.push('The lead identity is missing.');
    }
  }
  if (reasons.length > 0) return { ok: false, reasons };
  return {
    ok: true,
    draft: {
      subject: value.subject.trim(),
      textBody: value.textBody.trim(),
      htmlBody: value.htmlBody.trim(),
      category: value.category,
      evidenceReferences: value.evidenceReferences,
    },
  };
}

export async function generateFollowUpDraft(
  call: FollowUpCall,
  qualification: QualificationResult,
  senderName: string,
  companyBlurb: string,
  claude: ClaudeJsonClient
): Promise<EmailDraft> {
  const raw = await claude.completeJson(
    buildDraftPrompt(),
    buildDraftUserMessage(call, qualification, senderName, companyBlurb)
  );
  const jsonText = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ClaudeResponseError('Claude email draft was not valid JSON.');
  }
  const result = draftSchema.safeParse(parsed);
  if (!result.success) {
    throw new ClaudeResponseError('Claude email draft did not match the required schema.');
  }
  return {
    subject: result.data.subject.trim(),
    textBody: result.data.textBody.trim(),
    htmlBody: result.data.htmlBody.trim(),
    category: result.data.category,
    evidenceReferences: result.data.evidenceReferences,
  };
}
