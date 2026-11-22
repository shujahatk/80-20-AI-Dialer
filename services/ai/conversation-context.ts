import type {
  ConversationContext,
  OrganizationContext,
  CampaignContext,
  AgentContext,
  LeadContext,
  CallContext,
  ConversationStage,
  QualificationModel,
  ConversationTurn,
} from './types';
import { createInitialQualificationModel } from './qualification-engine';

export function createDefaultOrganizationContext(): OrganizationContext {
  return {
    name: 'RM Logistics & Recycling Solutions',
    industry: 'Industrial Surplus, Metal Recycling & Freight Recovery',
    approvedCapabilities: [
      'Industrial metal & scrap recycling management',
      'Surplus inventory recovery & asset liquidation',
      'Full-truckload & LTL collection logistics',
      'Direct-to-mill competitive commodity pricing',
      'On-site container drop-off & scheduled pickup',
    ],
    disclaimer:
      'Official pricing quotes are prepared by our commercial team after evaluating sample grade and volume specifications.',
  };
}

export function createDefaultAgentContext(agentName?: string, voiceId?: string): AgentContext {
  return {
    id: 'ag_rachel',
    name: agentName || 'Rachel',
    persona:
      'Consultative, energetic, professional, respectful, focused on logistics & industrial material review',
    openingMessage:
      'Hi, this is Rachel calling with RM AI. I was reaching out regarding operations at your facility.',
    callGoal:
      'Identify scrap/materials decision maker, qualify volume and current supplier, and arrange a specialist follow-up or quote review.',
    systemInstructions:
      'Be concise, polite, never make unauthorized commercial promises, and handle objections with curious open questions.',
    qualificationQuestions: [
      'Who oversees surplus materials, metals, or recycling logistics at your location?',
      'What types of scrap or surplus materials do you typically generate from operations?',
      'Roughly what volume or frequency do you see per month?',
      'Do you currently have an active contract, or do you review rates periodically?',
    ],
    objectionGuidance: {
      not_interested: 'Politely acknowledge and ask if they review pricing annually.',
      too_busy: 'Offer a quick 2-minute callback at their convenience.',
      send_email: 'Verify the best direct email address and person to address it to.',
      price_question: 'Explain pricing is based on grade/volume and offer a tailored quote.',
    },
    closingBehavior: 'Confirm next steps clearly, thank the prospect, and wrap up politely.',
    handoffRules: [
      'Prospect demands immediate binding price quote',
      'Prospect requests to speak with a human operator',
      'High-value multi-truckload opportunity qualified',
    ],
    voiceId: voiceId || '21m00Tcm4TlvDq8ikWAM',
    versionNumber: 1,
  };
}

export function buildConversationContext(params: {
  organization?: Partial<OrganizationContext>;
  lead: {
    id: string;
    name: string;
    company: string;
    phone: string;
    jobTitle?: string;
    email?: string | null;
    city?: string;
    region?: string;
    timezone?: string;
    notes?: string[];
    tags?: string[];
  };
  campaign?: {
    id: string;
    name: string;
    objective?: string;
    targetMarket?: string;
    qualificationGoal?: string;
  };
  agent?: Partial<AgentContext>;
  callId: string;
  attemptNumber?: number;
  currentStage?: ConversationStage;
  qualification?: QualificationModel;
  capturedFacts?: Record<string, unknown>;
  turns?: ConversationTurn[];
}): ConversationContext {
  const org: OrganizationContext = {
    ...createDefaultOrganizationContext(),
    ...(params.organization || {}),
  };

  const campaignCtx: CampaignContext = {
    id: params.campaign?.id || 'cmp_direct_outbound',
    name: params.campaign?.name || 'Industrial Materials Outreach',
    objective: params.campaign?.objective || 'Outbound lead qualification and quote scheduling',
    targetMarket: params.campaign?.targetMarket || 'Manufacturing, Distribution & Scrap Generators',
    qualificationGoal: params.campaign?.qualificationGoal || 'Identify 5+ tonnes/month generators',
  };

  const agentCtx: AgentContext = {
    ...createDefaultAgentContext(),
    ...(params.agent || {}),
  };

  const leadCtx: LeadContext = {
    id: params.lead.id,
    name: params.lead.name,
    company: params.lead.company,
    jobTitle: params.lead.jobTitle,
    phone: params.lead.phone,
    email: params.lead.email,
    city: params.lead.city,
    region: params.lead.region,
    timezone: params.lead.timezone,
    notes: params.lead.notes || [],
    tags: params.lead.tags || [],
    previousAttempts: params.attemptNumber || 0,
  };

  const callCtx: CallContext = {
    callId: params.callId,
    attemptNumber: params.attemptNumber || 1,
    direction: 'outbound',
  };

  return {
    organization: org,
    campaign: campaignCtx,
    agent: agentCtx,
    lead: leadCtx,
    call: callCtx,
    currentStage: params.currentStage || 'opening',
    qualification: params.qualification || createInitialQualificationModel(),
    capturedFacts: params.capturedFacts || {},
    turns: params.turns || [],
  };
}
