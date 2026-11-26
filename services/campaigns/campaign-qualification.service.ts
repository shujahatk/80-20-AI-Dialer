import type { LeadStatusDb } from '@/lib/supabase/types';

export type CanonicalQualificationOutcome =
  | 'QUALIFIED'
  | 'REJECTED'
  | 'NEEDS_REVIEW'
  | 'CALLBACK_REQUESTED'
  | 'NO_ANSWER'
  | 'DO_NOT_CALL';

export interface CampaignQualificationEvaluation {
  outcome: CanonicalQualificationOutcome;
  isQualified: boolean;
  decisionMakerInvolved: boolean;
  materialInterest: string | null;
  estimatedVolume: string | null;
  purchaseIntent: string | null;
  commercialRequirements: string[];
  disqualificationReasons: string[];
  evidence: string[];
  summary: string;
  recommendedDbStatus: LeadStatusDb;
  recommendedDomainStatus: string;
}

export interface PostCallAnalysisInput {
  callOutcome?: string | null;
  leadStatus?: string | null;
  summary?: string | null;
  sentiment?: string | null;
  dncRequested?: boolean;
  inVoicemail?: boolean;
  disconnectionReason?: string | null;
  decisionMakerIdentified?: boolean | null;
  contactName?: string | null;
  jobTitle?: string | null;
  emailAddress?: string | null;
  directPhoneNumber?: string | null;
  interestLevel?: string | null;
  materialContext?: string | null;
  customData?: Record<string, unknown> | null;
  transcriptText?: string | null;
}

export interface CampaignQualificationCriteria {
  requireDecisionMaker?: boolean;
  requireMaterialType?: boolean;
  requireVolume?: boolean;
  requirePurchaseIntent?: boolean;
  commercialRequirements?: string[];
  disqualificationKeywords?: string[];
}

export function evaluateCampaignPostCallQualification(
  analysis: PostCallAnalysisInput,
  campaignCriteria?: CampaignQualificationCriteria | null
): CampaignQualificationEvaluation {
  const customData = analysis.customData || {};
  const evidence: string[] = [];
  const disqualificationReasons: string[] = [];
  const commercialRequirements: string[] = [];

  // 1. DO NOT CALL
  if (
    analysis.dncRequested === true ||
    analysis.leadStatus === 'Do Not Call' ||
    analysis.callOutcome === 'DO_NOT_CALL'
  ) {
    evidence.push('Prospect requested Do Not Call (DNC) or asked to stop contact.');
    return {
      outcome: 'DO_NOT_CALL',
      isQualified: false,
      decisionMakerInvolved: Boolean(analysis.decisionMakerIdentified),
      materialInterest: null,
      estimatedVolume: null,
      purchaseIntent: 'none',
      commercialRequirements: [],
      disqualificationReasons: ['prospect_requested_dnc'],
      evidence,
      summary: analysis.summary || 'Prospect requested Do Not Call.',
      recommendedDbStatus: 'CONTACTED',
      recommendedDomainStatus: 'dnc',
    };
  }

  // 2. NO ANSWER
  const disconn = (analysis.disconnectionReason || '').toLowerCase();
  const isNoAnswer =
    analysis.inVoicemail === true ||
    disconn.includes('no_answer') ||
    disconn.includes('busy') ||
    disconn.includes('machine') ||
    disconn.includes('voicemail') ||
    analysis.callOutcome === 'NO_ANSWER';

  if (isNoAnswer) {
    evidence.push('Call was not answered or reached voicemail.');
    return {
      outcome: 'NO_ANSWER',
      isQualified: false,
      decisionMakerInvolved: false,
      materialInterest: null,
      estimatedVolume: null,
      purchaseIntent: 'none',
      commercialRequirements: [],
      disqualificationReasons: ['call_unanswered'],
      evidence,
      summary: analysis.summary || 'Call reached voicemail or was not answered.',
      recommendedDbStatus: 'CONTACTED',
      recommendedDomainStatus: 'contacted',
    };
  }

  // 3. CALLBACK REQUESTED
  if (
    analysis.leadStatus === 'Callback' ||
    analysis.callOutcome === 'CALLBACK_REQUESTED' ||
    customData.callback_requested === true
  ) {
    evidence.push('Prospect requested a scheduled callback.');
    return {
      outcome: 'CALLBACK_REQUESTED',
      isQualified: false,
      decisionMakerInvolved: Boolean(analysis.decisionMakerIdentified),
      materialInterest: analysis.materialContext || null,
      estimatedVolume: null,
      purchaseIntent: 'medium',
      commercialRequirements: ['callback_followup_needed'],
      disqualificationReasons: [],
      evidence,
      summary: analysis.summary || 'Prospect requested a scheduled callback.',
      recommendedDbStatus: 'CONTACTED',
      recommendedDomainStatus: 'callback-scheduled',
    };
  }

  // 4. REJECTED / NOT INTERESTED
  const isExplicitlyNotInterested =
    analysis.leadStatus === 'Not Interested' ||
    analysis.leadStatus === 'Unqualified' ||
    analysis.callOutcome === 'NOT_INTERESTED' ||
    analysis.callOutcome === 'REJECTED' ||
    analysis.interestLevel === 'none' ||
    customData.not_interested === true;

  if (isExplicitlyNotInterested) {
    evidence.push('Prospect explicitly stated not interested or unqualified.');
    disqualificationReasons.push('prospect_not_interested');
    return {
      outcome: 'REJECTED',
      isQualified: false,
      decisionMakerInvolved: Boolean(analysis.decisionMakerIdentified),
      materialInterest: null,
      estimatedVolume: null,
      purchaseIntent: 'none',
      commercialRequirements: [],
      disqualificationReasons,
      evidence,
      summary: analysis.summary || 'Prospect is not interested or does not qualify.',
      recommendedDbStatus: 'CONTACTED',
      recommendedDomainStatus: 'contacted',
    };
  }

  // Extract structured commercial parameters
  const dmInvolved = Boolean(
    analysis.decisionMakerIdentified === true ||
    (analysis.contactName && analysis.jobTitle) ||
    customData.decision_maker_confirmed === true
  );

  const materialInterest =
    (typeof customData.material_interest === 'string' && customData.material_interest) ||
    (typeof customData.material_type === 'string' && customData.material_type) ||
    (typeof analysis.materialContext === 'string' && analysis.materialContext.trim()) ||
    null;

  const estimatedVolume =
    (typeof customData.estimated_volume === 'string' && customData.estimated_volume) ||
    (typeof customData.volume === 'string' && customData.volume) ||
    (typeof customData.volume_tons_per_month === 'number' && `${customData.volume_tons_per_month} tons/mo`) ||
    null;

  const purchaseIntent =
    (typeof customData.purchase_intent === 'string' && customData.purchase_intent) ||
    analysis.interestLevel ||
    'unknown';

  if (dmInvolved) evidence.push(`Decision-maker confirmed: ${analysis.contactName || 'Identified'} (${analysis.jobTitle || 'Executive'})`);
  if (materialInterest) evidence.push(`Material/product interest: ${materialInterest}`);
  if (estimatedVolume) evidence.push(`Estimated volume / commercial frequency: ${estimatedVolume}`);

  // 5. EVALUATE QUALIFIED vs NEEDS_REVIEW
  // Rule: Do not qualify a prospect merely because contact information was captured!
  const requireDM = campaignCriteria?.requireDecisionMaker ?? true;
  const requireMat = campaignCriteria?.requireMaterialType ?? true;
  const requireVol = campaignCriteria?.requireVolume ?? true;

  const hasDecisionMaker = !requireDM || dmInvolved;
  const hasMaterial = !requireMat || Boolean(materialInterest);
  const hasVolume = !requireVol || Boolean(estimatedVolume);
  const hasIntent = purchaseIntent === 'high' || purchaseIntent === 'medium' || customData.qualified === true || analysis.leadStatus === 'Confirmed';

  const isFullyQualified =
    hasDecisionMaker &&
    hasMaterial &&
    hasVolume &&
    hasIntent &&
    disqualificationReasons.length === 0;

  if (isFullyQualified) {
    if (materialInterest) commercialRequirements.push(`Material: ${materialInterest}`);
    if (estimatedVolume) commercialRequirements.push(`Volume: ${estimatedVolume}`);
    evidence.push('All commercial qualification criteria satisfied.');

    return {
      outcome: 'QUALIFIED',
      isQualified: true,
      decisionMakerInvolved: dmInvolved,
      materialInterest,
      estimatedVolume,
      purchaseIntent,
      commercialRequirements,
      disqualificationReasons: [],
      evidence,
      summary: analysis.summary || 'Lead successfully qualified for commercial follow-up.',
      recommendedDbStatus: 'TECHNICAL_EVALUATION',
      recommendedDomainStatus: 'qualified',
    };
  }

  // 6. Otherwise: NEEDS_REVIEW
  // Capturing contact info alone, or partial interest without volume, requires review!
  if (!hasDecisionMaker) commercialRequirements.push('Decision-maker verification required');
  if (!hasMaterial) commercialRequirements.push('Material type/product specification missing');
  if (!hasVolume) commercialRequirements.push('Commercial volume/frequency unconfirmed');
  evidence.push('Incomplete commercial details. Placed in Needs Review for human SDR verification.');

  return {
    outcome: 'NEEDS_REVIEW',
    isQualified: false,
    decisionMakerInvolved: dmInvolved,
    materialInterest,
    estimatedVolume,
    purchaseIntent,
    commercialRequirements,
    disqualificationReasons: [],
    evidence,
    summary: analysis.summary || 'Contact information captured or partial interest shown. Needs Review before sales follow-up.',
    recommendedDbStatus: 'ENGAGED',
    recommendedDomainStatus: 'needs-review',
  };
}
