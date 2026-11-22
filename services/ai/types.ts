/**
 * Phase 7 Claude Conversation Engine & RM Sales Intelligence Types
 */

export type ConversationStage =
  | 'opening'
  | 'gatekeeper'
  | 'decision_maker'
  | 'discovery'
  | 'qualification'
  | 'objection'
  | 'follow_up'
  | 'handoff'
  | 'closing'
  | 'completed';

export type ObjectionCategory =
  | 'not_interested'
  | 'already_have_supplier'
  | 'send_email'
  | 'too_busy'
  | 'call_back'
  | 'wrong_person'
  | 'price_question'
  | 'logistics_question'
  | 'what_is_this_about'
  | 'privacy_or_dnc'
  | 'other';

export type HandoffTrigger =
  | 'pricing_negotiation'
  | 'purchase_authorization'
  | 'logistics_commitment'
  | 'high_value_lead'
  | 'prospect_requested_human'
  | 'ai_uncertainty'
  | 'compliance_question'
  | 'appointment_human_confirmation';

export interface QualificationModel {
  decisionMakerIdentified: boolean | null;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  materialAvailable: boolean | null;
  materialType: string | null;
  materialDescription: string | null;
  estimatedVolume: number | null;
  volumeUnit: string | null; // e.g. "tonnes/month", "loads/week", "units"
  frequency: string | null;
  location: string | null;
  timing: string | null;
  currentDisposalProcess: string | null;
  currentSupplierOrBuyer: string | null;
  interestLevel: 'high' | 'medium' | 'low' | 'none' | null;
  callbackRequested: boolean;
  callbackTime: string | null;
  appointmentRequested: boolean;
  emailRequested: boolean;
  humanHandoffRequired: boolean;
}

export interface CallbackDetails {
  date?: string;
  time?: string;
  timezone?: string;
  contact?: string;
  reason?: string;
}

export interface StructuredTurnResponse {
  spokenResponse: string;
  stage: ConversationStage;
  intent: string;
  extractedFacts: Record<string, unknown>;
  qualificationUpdates: Partial<QualificationModel>;
  objection: ObjectionCategory | null;
  nextAction: string;
  shouldEndCall: boolean;
  shouldHandoff: boolean;
  handoffReason: HandoffTrigger | null;
  shouldScheduleCallback: boolean;
  callbackDetails: CallbackDetails | null;
  dncDetected: boolean;
  dncReason: string | null;
  confidence: number;
}

export interface ConversationTurn {
  speaker: 'agent' | 'prospect' | 'system';
  text: string;
  timestampMs?: number;
  stage?: ConversationStage;
  wasInterrupted?: boolean;
}

export interface OrganizationContext {
  name: string;
  industry: string;
  approvedCapabilities: string[];
  disclaimer: string;
}

export interface CampaignContext {
  id: string;
  name: string;
  objective: string;
  targetMarket: string;
  qualificationGoal: string;
  callingWindow?: string;
}

export interface AgentContext {
  id: string;
  name: string;
  persona: string;
  openingMessage: string;
  callGoal: string;
  systemInstructions: string;
  qualificationQuestions: string[];
  objectionGuidance: Record<string, string>;
  closingBehavior: string;
  handoffRules: string[];
  voiceId: string;
  versionNumber?: number;
}

export interface LeadContext {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  company: string;
  jobTitle?: string;
  phone: string;
  email?: string | null;
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  notes?: string[];
  tags?: string[];
  previousAttempts?: number;
}

export interface CallContext {
  callId: string;
  attemptNumber: number;
  direction: 'outbound' | 'inbound';
}

export interface ConversationContext {
  organization: OrganizationContext;
  campaign: CampaignContext;
  agent: AgentContext;
  lead: LeadContext;
  call: CallContext;
  currentStage: ConversationStage;
  qualification: QualificationModel;
  capturedFacts: Record<string, unknown>;
  turns: ConversationTurn[];
}

export interface CallSummaryResult {
  summary: string;
  keyFacts: string[];
  qualification: QualificationModel;
  objections: string[];
  outcome: string;
  nextAction: string;
  handoffRequired: boolean;
  leadNote: string;
}

export interface LLMUsageStats {
  inputTokens: number;
  outputTokens: number;
  totalCostEstimate: number;
  latencyMs: number;
  model: string;
}
