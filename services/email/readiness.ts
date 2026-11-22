import { hasDocumentedLawfulBasis } from './eligibility';
import type { EligibilityReason, LawfulBasis } from './types';

export interface AutomationReadinessInput {
  resendApiKey: string;
  fromEmail: string;
  replyTo: string;
  webhookSecret: string;
  senderDomainVerified: boolean;
  campaignAuthorized: boolean;
}

function placeholder(value: string): boolean {
  const text = value.trim();
  return !text || text.includes('mock') || text.includes('your-') || text.includes('xxxx');
}

export function emailDomain(value: string): string | null {
  const wrapped = value.match(/<([^>]+)>/);
  const email = (wrapped?.[1] ?? value).trim().toLowerCase();
  const at = email.lastIndexOf('@');
  const domain = at > 0 ? email.slice(at + 1) : '';
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return null;
  return domain;
}

export function assessAutomationReadiness(input: AutomationReadinessInput): { canEnable: boolean; blockers: EligibilityReason[] } {
  const blockers: EligibilityReason[] = [];
  if (placeholder(input.resendApiKey)) {
    blockers.push({ code: 'resend_api_key', message: 'Resend API credentials are not configured.' });
  }
  if (!emailDomain(input.fromEmail) || placeholder(input.fromEmail)) {
    blockers.push({ code: 'resend_from_email', message: 'The verified Resend sender address is not configured.' });
  }
  if (!emailDomain(input.replyTo) || placeholder(input.replyTo)) {
    blockers.push({ code: 'resend_reply_to', message: 'A reply-to address is not configured.' });
  }
  if (placeholder(input.webhookSecret)) {
    blockers.push({
      code: 'suppression_webhook_unverified',
      message: 'Bounce and complaint suppression cannot run until the Resend webhook secret is set.',
    });
  }
  if (!input.senderDomainVerified) {
    blockers.push({
      code: 'sender_domain_unverified',
      message: 'The sender domain is not verified with Resend.',
    });
  }
  if (!input.campaignAuthorized) {
    blockers.push({
      code: 'campaign_not_authorized',
      message: 'No campaign has an authorized follow-up with a documented lawful basis.',
    });
  }
  return { canEnable: blockers.length === 0, blockers };
}

export function campaignCanAuthorizeFollowUp(enabled: boolean, basis: LawfulBasis | null, note: string | null): string | null {
  if (!enabled) return null;
  if (hasDocumentedLawfulBasis(basis, note)) return null;
  return 'This campaign can be authorized only with a documented lawful basis. A completed call is not enough.';
}

export function resendDomainIsVerified(payload: unknown, fromEmail: string): boolean {
  const domain = emailDomain(fromEmail);
  if (!domain || !payload || typeof payload !== 'object') return false;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return false;
  return data.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as { name?: unknown; status?: unknown };
    return String(row.name ?? '').toLowerCase() === domain && String(row.status ?? '').toLowerCase() === 'verified';
  });
}

export async function lookupVerifiedResendDomain(apiKey: string, fromEmail: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (placeholder(apiKey) || !emailDomain(fromEmail)) return false;
  const response = await fetchImpl('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) return false;
  const body: unknown = await response.json();
  return resendDomainIsVerified(body, fromEmail);
}
