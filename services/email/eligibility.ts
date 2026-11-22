import type { EligibilityReason, FollowUpCall, LawfulBasis, QualificationResult, Suppression } from './types';
import { SENDABLE_STATUSES } from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EU_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
]);

const EU_COUNTRY_MARKERS = [
  'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czech', 'denmark', 'estonia', 'finland', 'france',
  'germany', 'greece', 'hungary', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg', 'malta', 'netherlands',
  'poland', 'portugal', 'romania', 'slovakia', 'slovenia', 'spain', 'sweden', 'norway', 'iceland', 'liechtenstein',
];

const CALL_ONLY_BASIS = /^(completed call|call completed|call ended|they answered|answered the phone|the call)\.?$/i;

export function hasDocumentedLawfulBasis(basis: LawfulBasis | null, evidence: string | null): boolean {
  const note = (evidence || '').trim();
  return Boolean(basis) && note.length >= 12 && !CALL_ONLY_BASIS.test(note);
}

export function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  const email = value.trim();
  return email.length <= 320 && EMAIL_PATTERN.test(email);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isEuMarket(country: string, region: string): boolean {
  if (EU_REGIONS.has(region.trim().toUpperCase())) return true;
  const name = country.trim().toLowerCase();
  return EU_COUNTRY_MARKERS.some((marker) => name.includes(marker)) || name === 'eu' || name.includes('european union');
}

export function extractEmails(text: string): string[] {
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(found.map((item) => normalizeEmail(item)))];
}

export interface EligibilityFacts {
  call: FollowUpCall;
  qualification: QualificationResult;
  suppression: Suppression | null;
  alreadySent: boolean;
  automationEnabled: boolean;
  automationPaused: boolean;
}

export function evaluateEmailEligibility(facts: EligibilityFacts): { eligible: boolean; reasons: EligibilityReason[] } {
  const reasons: EligibilityReason[] = [];
  const { call, qualification } = facts;
  const lead = call.lead;
  const campaign = call.campaign;

  if (!call.analyzed) {
    reasons.push({ code: 'analysis_missing', message: 'Call analysis is not available.' });
  }
  if (!call.callFinished) {
    reasons.push({ code: 'call_not_finished', message: 'The call has not finished.' });
  }
  if (!lead) {
    reasons.push({ code: 'lead_not_associated', message: 'The call is not associated with a lead.' });
  }
  if (!campaign) {
    reasons.push({ code: 'campaign_not_associated', message: 'The call is not associated with a campaign.' });
  }

  const email = lead?.email ?? null;
  if (!isValidEmail(email)) {
    reasons.push({ code: 'invalid_email', message: 'The lead does not have a valid email address.' });
  } else if (lead) {
    const mentioned = extractEmails(call.transcript.map((turn) => turn.text).join('\n'));
    const own = normalizeEmail(email);
    const foreign = mentioned.filter((item) => item !== own);
    if (foreign.length > 0 && !mentioned.includes(own)) {
      reasons.push({
        code: 'email_not_on_lead',
        message: 'The conversation names a different email address from the lead record. No email was sent.',
      });
    }
  }

  if (lead?.unsubscribed || facts.suppression?.reason === 'unsubscribe') {
    reasons.push({ code: 'unsubscribed', message: 'The lead has unsubscribed from email.' });
  }
  if (lead?.stopAllContact || facts.suppression?.reason === 'stop_all' || qualification.status === 'DO_NOT_CONTACT') {
    reasons.push({ code: 'stop_all_contact', message: 'The lead asked for no further contact.' });
  }
  if (facts.suppression?.reason === 'bounce') {
    reasons.push({ code: 'bounced', message: 'This address is suppressed after a bounce.' });
  }
  if (facts.suppression?.reason === 'complaint') {
    reasons.push({ code: 'complaint', message: 'This address is suppressed after a complaint.' });
  }
  if (facts.suppression?.reason === 'manual') {
    reasons.push({ code: 'manual_suppression', message: 'This address is on the manual suppression list.' });
  }

  if (campaign && !campaign.emailFollowupEnabled) {
    reasons.push({ code: 'campaign_not_authorized', message: 'This campaign does not authorize automatic follow-up email.' });
  }

  if (lead && campaign) {
    const basis = lead.lawfulBasis ?? campaign.lawfulBasis;
    const evidence = lead.lawfulBasisEvidence || campaign.lawfulBasisNote;
    const eu = isEuMarket(lead.country, lead.region);
    if (!hasDocumentedLawfulBasis(basis, evidence)) {
      reasons.push({
        code: 'lawful_basis_missing',
        message: eu
          ? 'No documented lawful basis. A completed call does not authorize a marketing email for a Belgium or EU lead.'
          : 'No documented lawful basis for this email.',
      });
    }
  }

  if (facts.alreadySent) {
    reasons.push({ code: 'duplicate_follow_up', message: 'This follow-up was already sent for the lead and campaign.' });
  }

  const supported =
    SENDABLE_STATUSES.includes(qualification.status) &&
    qualification.emailFollowUpEligible &&
    !qualification.insufficientEvidence &&
    qualification.evidence.length > 0;

  if (!supported) {
    reasons.push({
      code: 'evidence_insufficient',
      message: 'The call outcome and conversation evidence do not support an email.',
    });
  }

  if (!facts.automationEnabled) {
    reasons.push({ code: 'automation_disabled', message: 'Email automation is turned off.' });
  }
  if (facts.automationPaused) {
    reasons.push({ code: 'automation_paused', message: 'Email automation is paused.' });
  }

  return { eligible: reasons.length === 0, reasons };
}
