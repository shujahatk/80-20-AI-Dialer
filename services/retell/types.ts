/**
 * RM AI DIALER — RETELL AI TYPES & NORMALIZED INTERFACES
 * Defines all domain, API, webhook, and provider-level models for Retell AI runtime.
 */

// -----------------------------------------------------------------------------
// 1. CALL & TELEPHONY REQUEST / RESPONSE MODELS
// -----------------------------------------------------------------------------

export interface RetellMetadata {
  organizationId: string;
  leadId: string;
  campaignId?: string | null;
  campaignLeadId?: string | null;
  agentId?: string | null;
  agentVersionId?: string | null;
  rmCallId?: string | null;
  operatorId?: string | null;
  [key: string]: unknown;
}

export interface RetellCreatePhoneCallRequest {
  from_number: string;
  to_number: string;
  override_agent_id?: string;
  override_agent_version?: number;
  retell_llm_dynamic_variables?: Record<string, string | number | boolean>;
  metadata?: RetellMetadata | Record<string, unknown>;
}

export type RetellCallStatus = 'registered' | 'ongoing' | 'ended' | 'error';

export type RetellDisconnectionReason =
  | 'user_hangup'
  | 'agent_hangup'
  | 'call_transfer'
  | 'voicemail_reached'
  | 'inactivity'
  | 'machine_detected'
  | 'concurrency_limit_reached'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'dial_failed'
  | 'dial_busy'
  | 'dial_no_answer'
  | 'error'
  | string;

export interface RetellTranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface RetellTranscriptUtterance {
  role: 'agent' | 'user' | 'system';
  content: string;
  words?: RetellTranscriptWord[];
}

export interface RetellCallAnalysis {
  call_summary?: string;
  call_successful?: boolean;
  in_voicemail?: boolean;
  user_sentiment?: 'Positive' | 'Neutral' | 'Negative' | string;
  call_completion_rating?: string;
  custom_analysis_data?: Record<string, unknown>;
}

export interface RetellCallResponse {
  call_id: string;
  call_type?: 'phone_call' | 'web_call';
  access_token?: string;
  agent_id?: string;
  call_status: RetellCallStatus;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  transcript?: string;
  transcript_object?: RetellTranscriptUtterance[];
  recording_url?: string;
  disconnection_reason?: RetellDisconnectionReason;
  call_analysis?: RetellCallAnalysis;
  call_cost?: {
    combined_cost?: number;
    total_duration_unit_price?: number;
    product_costs?: Array<{
      product: string;
      unit_price: number;
      cost: number;
    }>;
  };
  from_number?: string;
  to_number?: string;
  metadata?: RetellMetadata | Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 2. AGENT DEFINITIONS
// -----------------------------------------------------------------------------

export interface RetellAgentReference {
  agent_id: string;
  agent_name?: string;
  voice_id?: string;
  llm_websocket_url?: string;
  response_engine?: {
    type: 'retell-llm' | 'custom-llm';
    llm_id?: string;
    llm_websocket_url?: string;
  };
  language?: string;
  ambient_sound?: string;
  interruption_sensitivity?: number;
  responsiveness?: number;
  enable_backchannel?: boolean;
  backchannel_frequency?: number;
  backchannel_words?: string[];
  last_modification_timestamp?: number;
}

// -----------------------------------------------------------------------------
// 3. WEBHOOK EVENT STRUCTURES
// -----------------------------------------------------------------------------

export type RetellWebhookEventType =
  | 'call_started'
  | 'call_ended'
  | 'call_analyzed'
  | 'transcript_updated'
  | 'call_failure'
  | 'call_failed'
  | string;

export interface RetellBaseWebhookPayload {
  event: RetellWebhookEventType;
  call: RetellCallResponse;
}

export interface RetellCallStartedEvent extends RetellBaseWebhookPayload {
  event: 'call_started';
}

export interface RetellCallEndedEvent extends RetellBaseWebhookPayload {
  event: 'call_ended';
}

export interface RetellCallAnalyzedEvent extends RetellBaseWebhookPayload {
  event: 'call_analyzed';
}

export interface RetellTranscriptUpdatedEvent extends RetellBaseWebhookPayload {
  event: 'transcript_updated';
}

export type RetellWebhookEvent =
  | RetellCallStartedEvent
  | RetellCallEndedEvent
  | RetellCallAnalyzedEvent
  | RetellTranscriptUpdatedEvent
  | RetellBaseWebhookPayload;

// -----------------------------------------------------------------------------
// 4. PROVIDER HEALTH & NORMALIZED RM DATA
// -----------------------------------------------------------------------------

export interface RetellProviderHealth {
  status: 'healthy' | 'degraded' | 'unreachable' | 'unconfigured';
  authenticated: boolean;
  latencyMs?: number;
  agentCount?: number;
  errorMessage?: string | null;
  checkedAt: string;
}

export interface NormalizedCallStartResult {
  success: boolean;
  provider: 'retell';
  providerCallId: string;
  status: 'queued' | 'ringing' | 'in_progress' | 'failed';
  rawResponse?: RetellCallResponse;
  error?: string;
}

export interface NormalizedTranscriptEntry {
  speaker: 'ai' | 'lead' | 'operator' | 'system';
  sequenceNumber: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export type RetellQualificationLeadStatus =
  | 'Confirmed'
  | 'Interested'
  | 'Follow-up'
  | 'Callback'
  | 'Not Interested'
  | 'Do Not Call'
  | 'Unqualified';

export interface NormalizedPostCallAnalysis {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  isSuccessful: boolean;
  inVoicemail: boolean;
  qualificationData: Record<string, unknown>;
  dispositionRecommendation?: string;
  dncRequested?: boolean;
  callbackRequested?: boolean;
  callbackTime?: string;
  rawAnalysis?: RetellCallAnalysis;

  // Retell Native Lead Qualification Fields
  decisionMakerIdentified?: boolean;
  contactName?: string | null;
  jobTitle?: string | null;
  emailAddress?: string | null;
  directPhoneNumber?: string | null;
  interestLevel?: string;
  materialContext?: string | null;
  followUpRequirements?: string | null;
  callOutcome?: string;
  leadStatus?: RetellQualificationLeadStatus;
}
