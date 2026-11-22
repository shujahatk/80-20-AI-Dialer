/**
 * 80/20 AI DIALER — SHARED DOMAIN TYPES
 * Authoritative domain model matching application usage, Supabase schemas, and Retell AI voice pipeline.
 */

// =============================================================================
// 1. USERS, ROLES & PROFILES
// =============================================================================

export type UserRole = 'admin' | 'manager' | 'agent' | 'operator' | 'sdr' | 'executive' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  avatarUrl?: string;
  status?: string;
  nodeId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  id: string;
  organizationId?: string;
  displayName?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// 2. LEADS, STATUSES & FILTERS
// =============================================================================

export type RetellQualificationStatus =
  | 'Confirmed'
  | 'Interested'
  | 'Follow-up'
  | 'Callback'
  | 'Not Interested'
  | 'Do Not Call'
  | 'Unqualified';

export type LeadStatus =
  | 'new'
  | 'in-queue'
  | 'queued'
  | 'dialing'
  | 'in_progress'
  | 'connected'
  | 'contacted'
  | 'voicemail-left'
  | 'objection-handled'
  | 'qualified'
  | 'meeting-booked'
  | 'converted'
  | 'callback-scheduled'
  | 'callback'
  | 'dnc'
  | 'unreachable'
  | 'unqualified'
  | 'Confirmed'
  | 'Interested'
  | 'Follow-up'
  | 'Callback'
  | 'Not Interested'
  | 'Do Not Call';

export type LeadPriority = 'high' | 'medium' | 'low';

export interface LeadNextAction {
  type?: 'demo' | 'retry' | 'callback' | 'call' | string;
  scheduledTime?: string;
  description?: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  title?: string;
  email?: string;
  timezone?: string;
  localTime?: string;
  fleetSize?: string;
  tags?: string[];
  status: LeadStatus;
  priority?: LeadPriority;
  campaignId?: string;
  campaignName?: string;
  attempts?: number;
  maxAttempts?: number;
  lastOutcome?: string;
  lastCallDate?: string;
  assignedAgent?: string;
  nextAction?: LeadNextAction;
  buyingIntentScore?: number;
  priorAttemptAudit?: string;
  notes?: string[];
  isDnc?: boolean;
  dncReason?: string | null;
  source?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadFilter {
  search?: string;
  status?: LeadStatus | 'All' | string;
  priority?: LeadPriority | 'All' | string;
  isDnc?: boolean;
  source?: string;
  campaignId?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

// =============================================================================
// 3. CALLS, TRANSCRIPTS & TELEPHONY
// =============================================================================

export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'in_progress'
  | 'completed'
  | 'ended'
  | 'failed'
  | 'busy'
  | 'no-answer'
  | 'no_answer'
  | 'canceled'
  | 'queued';

export type CallOutcome =
  | 'booked_meeting'
  | 'appointment'
  | 'qualified_followup'
  | 'qualified'
  | 'callback_scheduled'
  | 'callback'
  | 'voicemail_dropped'
  | 'voicemail'
  | 'not_interested'
  | 'dnc'
  | 'failed'
  | 'no_answer'
  | 'connected'
  | 'technical_objection';

export type CallType = 'inbound' | 'outbound' | 'web';

export interface TranscriptEntry {
  id: string;
  speaker: 'ai' | 'prospect' | 'agent' | 'user' | string;
  speakerName: string;
  timestamp: string;
  timeSeconds?: number;
  stageBadge?: string;
  stageBadgeType?: string;
  text: string;
  confidence?: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | string;
  sentimentScore?: number;
  isStreaming?: boolean;
}

export interface Call {
  id: string;
  sessionId: string;
  leadId: string;
  leadName: string;
  leadTitle?: string;
  company: string;
  phone: string;
  campaignId: string;
  campaignName: string;
  agentId: string;
  agentName: string;
  status: CallStatus;
  outcome: CallOutcome;
  outcomeLabel?: string;
  durationSeconds: number;
  durationFormatted: string;
  timestamp: string;
  sentimentScore?: number;
  sentimentLabel?: string;
  executiveSummary?: string;
  keyFacts?: Record<string, string>;
  nextStep?: string;
  audioUrl?: string;
  transcript?: TranscriptEntry[];
  organizationId?: string;
  recordingUrl?: string;
}

export interface CallRecord {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  lead_id: string | null;
  ai_agent_id: string | null;
  provider: string;
  provider_call_id: string | null;
  retell_call_id: string | null;
  direction: 'inbound' | 'outbound';
  status: CallStatus;
  outcome: CallOutcome | null;
  from_number: string;
  to_number: string;
  duration_seconds: number;
  sentiment: string | null;
  disconnection_reason: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallDetails extends Call {
  events?: unknown[];
  recording?: unknown;
  lead?: unknown;
}

// =============================================================================
// 4. CAMPAIGNS & CAMPAIGN STATUSES
// =============================================================================

export type CampaignStatus =
  | 'draft'
  | 'ready'
  | 'paused'
  | 'archived'
  | 'scheduled'
  | 'running'
  | 'live'
  | 'completed'
  | 'cancelled';

export interface CampaignStats {
  connectedPickups: number;
  pickupRate: number;
  aiQualified: number;
  qualifiedRate: number;
  bookedAppointments: number;
  conversionRate: number;
}

export interface CampaignProgressMetrics {
  totalLeads: number;
  attempted: number;
  remaining: number;
  connected: number;
  qualified: number;
  appointments: number;
  callbacks: number;
  dnc: number;
  failed: number;
  completed: number;
  progressPercent: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  leadCount: number;
  completedLeads: number;
  progressPercent: number;
  agentId: string;
  agentName: string;
  voiceModel: string;
  concurrentLines: number;
  maxConcurrentLines: number;
  pacingMultiplier: number;
  scheduleWindow: string;
  retryRule: string;
  stats: CampaignStats;
  predictedFinish?: string;
  batchSize?: number;
  callingDays?: number[];
  callingWindowStart?: string;
  callingWindowEnd?: string;
  timezone?: string;
  maxAttempts?: number;
  retryDelayMinutes?: number;
  startDate?: string | null;
  endDate?: string | null;
  detailedMetrics?: CampaignProgressMetrics;
}

// =============================================================================
// 5. AI AGENTS & CONFIGURATIONS
// =============================================================================

export type AgentStatus = 'active' | 'standby' | 'tuning' | 'draft' | 'archived';

export interface ScriptPhase {
  id: number;
  title: string;
  scriptText: string;
  passRate?: string;
  isGate?: boolean;
  criteria?: string[];
}

export interface ObjectionRule {
  pattern: string;
  pivotStrategy: string;
}

export interface AgentStats {
  callsMade: number;
  bookingRate: number;
  avgLatencyMs: number;
}

export interface AiAgent {
  id: string;
  name: string;
  role: string;
  mandate: string;
  status: 'active' | 'standby' | 'tuning';
  rank?: number;
  voiceProvider: string;
  voiceName: string;
  voiceModel: string;
  vocalTone: string;
  speedCadence: number;
  stability: number;
  similarityWarmth: number;
  languageModel: string;
  interruptionThresholdMs: number;
  noiseSuppression: string;
  latencyMode: string;
  systemPrompt: string;
  scriptPhases: ScriptPhase[];
  objectionRules: ObjectionRule[];
  stats: AgentStats;
  organizationId?: string;
}

export type Agent = AiAgent;

export interface AgentConfig {
  id?: string;
  name: string;
  persona: string;
  greeting?: string;
  systemPrompt?: string;
  voiceProvider?: string;
  voiceId?: string;
  speakingSpeed?: number;
  stability?: number;
  similarity?: number;
  interruptionThresholdMs?: number;
  qualificationRules?: Record<string, unknown>;
  objectionRules?: Record<string, unknown>;
  handoffRules?: Record<string, unknown>;
}

export interface AgentPromptConfig {
  systemPrompt: string;
  openingMessage?: string;
  callGoal?: string;
  questions?: string[];
  objections?: Array<{ trigger: string; response: string }>;
  closingBehavior?: string;
  handoffRules?: string;
}

// =============================================================================
// 6. DASHBOARD METRICS & CALLBACKS
// =============================================================================

export interface DashboardMetric {
  id: string;
  title: string;
  value: string | number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
  subtext?: string;
  icon?: string;
  color?: string;
  sparklinePoints?: number[];
}

export interface Callback {
  id: string;
  leadId: string;
  leadName: string;
  leadTitle?: string;
  company: string;
  timezone?: string;
  dueIn: string;
  dueTimestamp: string;
  assignedAgent?: string;
  note?: string;
  phone?: string;
  status?: string;
}

// =============================================================================
// 7. TELEPHONY GUARDRAILS & PROVIDER HEALTH
// =============================================================================

export interface TelephonyGuardrails {
  maxConcurrentTrunks: number;
  activeTrunks: number;
  enforceTimezoneFilter: boolean;
  callingHoursStart: string;
  callingHoursEnd: string;
  skipHolidays: boolean;
  localPresenceEnabled: boolean;
  totalDidPoolCount: number;
  amdSensitivity: string;
  retentionDays: number;
  humanTakeoverHotkey: string;
  webhookUrl: string;
  webhookStatus: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
  tier: string;
  state: 'connected' | 'degraded' | 'disconnected' | string;
  latencyMs: number;
  uptimePercent: number;
  activeChannels?: number;
  maxChannels?: number;
  details?: string;
  extraMeta?: Record<string, unknown>;
}

// =============================================================================
// 8. RETELL-NATIVE LEAD QUALIFICATION
// =============================================================================

export type QualificationStatus =
  | 'QUALIFIED'
  | 'INTERESTED'
  | 'FOLLOW_UP_REQUIRED'
  | 'NOT_INTERESTED'
  | 'NO_ANSWER'
  | 'UNREACHABLE'
  | 'DO_NOT_CONTACT'
  | 'REVIEW_REQUIRED';

export type InterestLevel = 'none' | 'low' | 'medium' | 'high' | 'unknown';

export interface EvidenceQuote {
  quote: string;
  speaker: 'ai' | 'lead' | 'operator' | 'system' | string;
}

export interface LeadQualificationResult {
  status: QualificationStatus;
  interestLevel: InterestLevel;
  customerRequirements: string[];
  mainObjections: string[];
  requestedInformation: string[];
  nextRecommendedAction: string;
  emailFollowUpEligible: boolean;
  evidence: EvidenceQuote[];
  insufficientEvidence: boolean;
  customAnalysisData?: Record<string, unknown>;
  sentimentScore?: number;
}

export type QualificationResult = LeadQualificationResult;

// =============================================================================
// 9. EMAIL TEMPLATES & EMAIL LOGS
// =============================================================================

export type EmailCategory = 'qualification_follow_up' | 'requested_information' | 'general_follow_up';

export interface EmailTemplate {
  id: string;
  organizationId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  category: EmailCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  organizationId: string;
  leadId: string | null;
  callId: string | null;
  toEmail: string;
  fromEmail: string;
  subject: string;
  category: EmailCategory;
  resendId: string | null;
  status: 'queued' | 'sending' | 'accepted' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'retry';
  error?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface EmailDraft {
  subject: string;
  htmlBody: string;
  textBody: string;
  category: EmailCategory;
  evidenceReferences: string[];
}
