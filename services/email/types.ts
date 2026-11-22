export const QUALIFICATION_STATUSES = [
  'QUALIFIED',
  'INTERESTED',
  'FOLLOW_UP_REQUIRED',
  'NOT_INTERESTED',
  'NO_ANSWER',
  'UNREACHABLE',
  'DO_NOT_CONTACT',
  'REVIEW_REQUIRED',
] as const;

export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

export const SENDABLE_STATUSES: readonly QualificationStatus[] = [
  'QUALIFIED',
  'INTERESTED',
  'FOLLOW_UP_REQUIRED',
];

export type InterestLevel = 'none' | 'low' | 'medium' | 'high' | 'unknown';

export type LawfulBasis = 'consent' | 'contract' | 'legitimate_interest_documented';

export type EmailCategory = 'qualification_follow_up' | 'requested_information' | 'general_follow_up';

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'retry'
  | 'suppressed'
  | 'accepted'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed';

export type MessageStatus = 'queued' | 'sending' | 'accepted' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'retry';

export interface TranscriptTurn {
  speaker: 'ai' | 'lead' | 'operator' | 'system';
  text: string;
}

export interface EvidenceQuote {
  quote: string;
  speaker: TranscriptTurn['speaker'];
}

export interface QualificationResult {
  status: QualificationStatus;
  interestLevel: InterestLevel;
  customerRequirements: string[];
  mainObjections: string[];
  requestedInformation: string[];
  nextRecommendedAction: string;
  emailFollowUpEligible: boolean;
  evidence: EvidenceQuote[];
  insufficientEvidence: boolean;
}

export interface EmailDraft {
  subject: string;
  htmlBody: string;
  textBody: string;
  category: EmailCategory;
  evidenceReferences: string[];
}

export interface FollowUpLead {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string | null;
  country: string;
  region: string;
  isDnc: boolean;
  unsubscribed: boolean;
  stopAllContact: boolean;
  emailOptIn: boolean;
  lawfulBasis: LawfulBasis | null;
  lawfulBasisEvidence: string | null;
}

export interface FollowUpCampaign {
  id: string;
  name: string;
  emailFollowupEnabled: boolean;
  lawfulBasis: LawfulBasis | null;
  lawfulBasisNote: string | null;
  instructions: string | null;
}

export interface FollowUpCall {
  organizationId: string;
  callId: string;
  callStatus: string;
  callFinished: boolean;
  analyzed: boolean;
  disconnectionReason: string | null;
  transcript: TranscriptTurn[];
  lead: FollowUpLead | null;
  campaign: FollowUpCampaign | null;
}

export interface AutomationSettings {
  enabled: boolean;
  paused: boolean;
  hourlySendLimit: number;
  senderName: string;
  companyBlurb: string;
  inboundConfigured: boolean;
  senderDomainVerified: boolean;
}

export interface EligibilityReason {
  code: string;
  message: string;
}

export interface EmailJob {
  id: string;
  organizationId: string;
  callId: string;
  leadId: string | null;
  campaignId: string | null;
  idempotencyKey: string;
  status: JobStatus;
  qualification: QualificationResult | null;
  eligibilityReasons: EligibilityReason[];
  draft: EmailDraft | null;
  attempts: number;
  nextAttemptAt: string | null;
  lockedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  jobId: string;
  organizationId: string;
  leadId: string;
  campaignId: string;
  callId: string;
  toEmail: string;
  fromEmail: string;
  replyTo: string | null;
  subject: string;
  htmlBody: string;
  textBody: string;
  category: EmailCategory;
  resendId: string | null;
  idempotencyKey: string;
  status: MessageStatus;
  lastError: string | null;
  acceptedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailEvent {
  id: string;
  organizationId: string;
  messageId: string | null;
  jobId: string | null;
  eventType: string;
  providerEventId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  organizationId: string;
  leadId: string | null;
  callId: string | null;
  jobId: string | null;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface EmailCounts {
  queued: number;
  accepted: number;
  delivered: number;
  bounced: number;
  failed: number;
  suppressed: number;
  replies: number;
}

export interface Suppression {
  organizationId: string;
  email: string;
  reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual' | 'stop_all';
}

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  enabled: false,
  paused: false,
  hourlySendLimit: 30,
  senderName: 'RM Group',
  companyBlurb: '',
  inboundConfigured: false,
  senderDomainVerified: false,
};

export function emptyQualification(status: QualificationStatus, action: string): QualificationResult {
  return {
    status,
    interestLevel: status === 'NOT_INTERESTED' || status === 'DO_NOT_CONTACT' ? 'none' : 'unknown',
    customerRequirements: [],
    mainObjections: [],
    requestedInformation: [],
    nextRecommendedAction: action,
    emailFollowUpEligible: false,
    evidence: [],
    insufficientEvidence: true,
  };
}
