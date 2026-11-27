import type { LeadStatusDb } from '@/lib/supabase/types';

export type CanonicalQualificationOutcome =
  | 'QUALIFIED'
  | 'NOT_QUALIFIED'
  | 'NEEDS_REVIEW'
  | 'FOLLOW_UP_REQUIRED'
  | 'CALLBACK_REQUESTED'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'VOICEMAIL'
  | 'FAILED'
  | 'COMPLETED'
  | 'DO_NOT_CALL'
  | 'REJECTED'; // backward compatibility

export interface CampaignQualificationEvaluation {
  outcome: CanonicalQualificationOutcome;
  isQualified: boolean;
  decisionMakerInvolved: boolean;
  contactName: string | null;
  companyName: string | null;
  jobTitle: string | null;
  emailAddress: string | null;
  directPhoneNumber: string | null;
  materialInterest: string | null;
  estimatedVolume: string | null;
  materialGrade: string | null;
  purchaseIntent: string | null;
  commercialRequirements: string[];
  customerObjections: string[];
  nextSteps: string | null;
  callbackRequested: boolean;
  callbackTime: string | null;
  followUpRequirements: string | null;
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
  companyName?: string | null;
  jobTitle?: string | null;
  emailAddress?: string | null;
  directPhoneNumber?: string | null;
  interestLevel?: string | null;
  materialInterest?: string | null;
  materialContext?: string | null;
  estimatedVolume?: string | null;
  materialGrade?: string | null;
  purchaseIntent?: string | null;
  commercialRequirements?: string | null;
  customerObjections?: string | null;
  nextSteps?: string | null;
  callbackRequested?: boolean | null;
  callbackTime?: string | null;
  followUpRequirements?: string | null;
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

  // Extract all business information first
  const contactName =
    analysis.contactName ||
    (typeof customData.contact_name === 'string' ? customData.contact_name : null) ||
    (typeof customData.customer_name === 'string' ? customData.customer_name : null) ||
    (typeof customData.decision_maker_name === 'string' ? customData.decision_maker_name : null);

  const companyName =
    analysis.companyName ||
    (typeof customData.company_name === 'string' ? customData.company_name : null) ||
    (typeof customData.company === 'string' ? customData.company : null);

  const jobTitle =
    analysis.jobTitle ||
    (typeof customData.job_title === 'string' ? customData.job_title : null) ||
    (typeof customData.position === 'string' ? customData.position : null) ||
    (typeof customData.title === 'string' ? customData.title : null);

  const emailAddress =
    analysis.emailAddress ||
    (typeof customData.email_address === 'string' ? customData.email_address : null) ||
    (typeof customData.email === 'string' ? customData.email : null);

  const directPhoneNumber =
    analysis.directPhoneNumber ||
    (typeof customData.direct_phone_number === 'string' ? customData.direct_phone_number : null) ||
    (typeof customData.direct_phone === 'string' ? customData.direct_phone : null) ||
    (typeof customData.phone === 'string' ? customData.phone : null);

  const materialInterest =
    analysis.materialInterest ||
    (typeof customData.material_interest === 'string' && customData.material_interest) ||
    (typeof customData.interested_material === 'string' && customData.interested_material) ||
    (typeof customData.material_type === 'string' && customData.material_type) ||
    (typeof customData.product === 'string' && customData.product) ||
    (typeof analysis.materialContext === 'string' && analysis.materialContext.trim()) ||
    null;

  const estimatedVolume =
    analysis.estimatedVolume ||
    (typeof customData.estimated_volume === 'string' && customData.estimated_volume) ||
    (typeof customData.volume === 'string' && customData.volume) ||
    (typeof customData.monthly_volume === 'string' && customData.monthly_volume) ||
    (typeof customData.volume_tons_per_month === 'number' && `${customData.volume_tons_per_month} tons/mo`) ||
    null;

  const materialGrade =
    analysis.materialGrade ||
    (typeof customData.material_grade === 'string' && customData.material_grade) ||
    (typeof customData.grade === 'string' && customData.grade) ||
    (typeof customData.quality === 'string' && customData.quality) ||
    null;

  const purchaseIntent =
    analysis.purchaseIntent ||
    (typeof customData.purchase_intent === 'string' && customData.purchase_intent) ||
    analysis.interestLevel ||
    'unknown';

  const customerObjections: string[] = Array.isArray(customData.customer_objections)
    ? (customData.customer_objections as string[])
    : Array.isArray(customData.objections)
      ? (customData.objections as string[])
      : typeof customData.customer_objections === 'string'
        ? [customData.customer_objections]
        : [];

  const nextSteps =
    (typeof customData.next_steps === 'string' && customData.next_steps) ||
    (typeof customData.next_step === 'string' && customData.next_step) ||
    (typeof customData.next_recommended_action === 'string' && customData.next_recommended_action) ||
    null;

  const callbackRequested = Boolean(
    analysis.callbackRequested ||
    analysis.leadStatus === 'Callback' ||
    analysis.callOutcome === 'CALLBACK_REQUESTED' ||
    customData.callback_requested === true ||
    customData.callback === true ||
    customData.callback_time
  );

  const callbackTime =
    analysis.callbackTime ||
    (typeof customData.callback_time === 'string' ? customData.callback_time : null) ||
    (typeof customData.scheduled_callback === 'string' ? customData.scheduled_callback : null);

  const followUpRequirements =
    analysis.followUpRequirements ||
    (typeof customData.follow_up_requirements === 'string' ? customData.follow_up_requirements : null) ||
    (typeof customData.followup === 'string' ? customData.followup : null);

  const disconn = (analysis.disconnectionReason || '').toLowerCase();

  // Helper builder for common payload
  const buildResult = (
    outcome: CanonicalQualificationOutcome,
    isQualified: boolean,
    summary: string,
    recommendedDbStatus: LeadStatusDb,
    recommendedDomainStatus: string,
    overrideEvidence?: string[]
  ): CampaignQualificationEvaluation => ({
    outcome,
    isQualified,
    decisionMakerInvolved: Boolean(
      analysis.decisionMakerIdentified === true ||
      (contactName && jobTitle) ||
      customData.decision_maker_confirmed === true
    ),
    contactName,
    companyName,
    jobTitle,
    emailAddress,
    directPhoneNumber,
    materialInterest,
    estimatedVolume,
    materialGrade,
    purchaseIntent,
    commercialRequirements,
    customerObjections,
    nextSteps,
    callbackRequested,
    callbackTime,
    followUpRequirements,
    disqualificationReasons,
    evidence: overrideEvidence || evidence,
    summary: analysis.summary || summary,
    recommendedDbStatus,
    recommendedDomainStatus,
  });

  // 1. DO NOT CALL
  if (
    analysis.dncRequested === true ||
    analysis.leadStatus === 'Do Not Call' ||
    analysis.callOutcome === 'DO_NOT_CALL'
  ) {
    evidence.push('Prospect requested Do Not Call (DNC) or asked to stop contact.');
    disqualificationReasons.push('prospect_requested_dnc');
    return buildResult('DO_NOT_CALL', false, 'Prospect requested Do Not Call.', 'dnc', 'dnc');
  }

  // 2. VOICEMAIL
  const isVoicemail =
    analysis.inVoicemail === true ||
    disconn.includes('voicemail') ||
    disconn.includes('machine_detected') ||
    analysis.callOutcome === 'VOICEMAIL';

  if (isVoicemail) {
    evidence.push('Call reached voicemail or automated answering machine.');
    disqualificationReasons.push('voicemail_reached');
    return buildResult('VOICEMAIL', false, 'Call reached voicemail.', 'CONTACTED', 'contacted');
  }

  // 3. BUSY
  const isBusy =
    disconn.includes('busy') ||
    disconn.includes('dial_busy') ||
    analysis.callOutcome === 'BUSY';

  if (isBusy) {
    evidence.push('Line busy or engaged.');
    disqualificationReasons.push('line_busy');
    return buildResult('BUSY', false, 'Line busy or engaged.', 'CONTACTED', 'contacted');
  }

  // 4. NO ANSWER
  const isNoAnswer =
    disconn.includes('no_answer') ||
    disconn.includes('dial_no_answer') ||
    analysis.callOutcome === 'NO_ANSWER';

  if (isNoAnswer) {
    evidence.push('Call was not answered or timed out.');
    disqualificationReasons.push('call_unanswered');
    return buildResult('NO_ANSWER', false, 'Call was not answered.', 'CONTACTED', 'contacted');
  }

  // 5. FAILED
  const isFailed =
    disconn.includes('failed') ||
    disconn.includes('dial_failed') ||
    disconn.includes('error') ||
    analysis.callOutcome === 'FAILED';

  if (isFailed) {
    evidence.push(`Call failed: ${analysis.disconnectionReason || 'Dial error'}`);
    disqualificationReasons.push('telephony_failure');
    return buildResult('FAILED', false, 'Call failed to connect.', 'CONTACTED', 'new');
  }

  // 6. CALLBACK REQUESTED
  if (callbackRequested) {
    evidence.push(`Prospect requested scheduled callback${callbackTime ? ` at ${callbackTime}` : ''}.`);
    commercialRequirements.push('callback_followup_needed');
    return buildResult('CALLBACK_REQUESTED', false, 'Prospect requested a scheduled callback.', 'CONTACTED', 'callback-scheduled');
  }

  // 7. REJECTED / NOT INTERESTED / NOT QUALIFIED
  const isExplicitlyNotInterested =
    analysis.leadStatus === 'Not Interested' ||
    analysis.leadStatus === 'Unqualified' ||
    analysis.callOutcome === 'NOT_INTERESTED' ||
    analysis.callOutcome === 'NOT_QUALIFIED' ||
    analysis.callOutcome === 'REJECTED' ||
    analysis.interestLevel === 'none' ||
    customData.not_interested === true;

  if (isExplicitlyNotInterested) {
    evidence.push('Prospect explicitly stated not interested or does not qualify.');
    disqualificationReasons.push('prospect_not_interested');
    return buildResult('NOT_INTERESTED', false, 'Prospect is not interested or does not qualify.', 'CONTACTED', 'contacted');
  }

  // Decision maker extraction check
  const dmInvolved = Boolean(
    analysis.decisionMakerIdentified === true ||
    (contactName && jobTitle) ||
    customData.decision_maker_confirmed === true
  );

  if (dmInvolved) evidence.push(`Decision-maker confirmed: ${contactName || 'Identified'} (${jobTitle || 'Executive'})`);
  if (materialInterest) evidence.push(`Material/product interest: ${materialInterest}`);
  if (estimatedVolume) evidence.push(`Estimated volume / commercial frequency: ${estimatedVolume}`);

  // 8. EVALUATE QUALIFIED vs NEEDS_REVIEW vs FOLLOW_UP_REQUIRED
  // Rule: Do not qualify a prospect merely because contact information was captured!
  const requireDM = campaignCriteria?.requireDecisionMaker ?? true;
  const requireMat = campaignCriteria?.requireMaterialType ?? true;
  const requireVol = campaignCriteria?.requireVolume ?? true;

  const hasDecisionMaker = !requireDM || dmInvolved;
  const hasMaterial = !requireMat || Boolean(materialInterest);
  const hasVolume = !requireVol || Boolean(estimatedVolume);
  const hasIntent =
    purchaseIntent === 'high' ||
    purchaseIntent === 'medium' ||
    Boolean(analysis.purchaseIntent) ||
    analysis.interestLevel === 'high' ||
    analysis.interestLevel === 'medium' ||
    customData.qualified === true ||
    analysis.leadStatus === 'Confirmed';

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

    return buildResult(
      'QUALIFIED',
      true,
      'Lead successfully qualified for commercial follow-up.',
      'TECHNICAL_EVALUATION',
      'qualified'
    );
  }

  // 9. NEEDS_REVIEW
  // Strict Commercial Rule: Contact information captured without verified commercial volume or material grade
  // MUST evaluate to NEEDS_REVIEW (DB: ENGAGED) and NEVER QUALIFIED.
  const hasContactInfo = Boolean(contactName || emailAddress || directPhoneNumber);
  if ((dmInvolved || hasContactInfo) && (!hasVolume || !hasMaterial)) {
    if (!hasDecisionMaker) commercialRequirements.push('Decision-maker verification required');
    if (!hasMaterial) commercialRequirements.push('Material type/product specification missing');
    if (!hasVolume) commercialRequirements.push('Commercial volume/frequency unconfirmed');
    evidence.push('Contact details captured without confirmed commercial volume or material specification. Placed in Needs Review for human SDR verification.');

    return buildResult(
      'NEEDS_REVIEW',
      false,
      'Prospect engaged and provided contact info, but commercial volume or material grade requires SDR review.',
      'ENGAGED',
      'needs-review'
    );
  }

  // 10. FOLLOW_UP_REQUIRED
  if (
    analysis.leadStatus === 'Follow-up' ||
    analysis.callOutcome === 'FOLLOW_UP_REQUIRED' ||
    Boolean(followUpRequirements)
  ) {
    if (followUpRequirements) commercialRequirements.push(`Follow-up requirement: ${followUpRequirements}`);
    evidence.push('Prospect requested commercial follow-up discussion.');
    return buildResult('FOLLOW_UP_REQUIRED', false, 'Commercial follow-up required.', 'CONTACTED', 'contacted');
  }

  // 11. INTERESTED
  if (
    analysis.leadStatus === 'Interested' ||
    analysis.callOutcome === 'INTERESTED' ||
    analysis.sentiment === 'positive' ||
    purchaseIntent === 'medium' ||
    purchaseIntent === 'high'
  ) {
    if (materialInterest) commercialRequirements.push(`Material: ${materialInterest}`);
    evidence.push('Prospect expressed positive commercial interest.');
    return buildResult('INTERESTED', false, 'Prospect expressed commercial interest.', 'CONTACTED', 'contacted');
  }

  // 12. Otherwise: NEEDS_REVIEW
  // Capturing contact info alone, or partial interest without volume, requires review!
  if (!hasDecisionMaker) commercialRequirements.push('Decision-maker verification required');
  if (!hasMaterial) commercialRequirements.push('Material type/product specification missing');
  if (!hasVolume) commercialRequirements.push('Commercial volume/frequency unconfirmed');
  evidence.push('Incomplete commercial details. Placed in Needs Review for human SDR verification.');

  return buildResult(
    'NEEDS_REVIEW',
    false,
    'Contact information captured or partial interest shown. Needs Review before sales follow-up.',
    'ENGAGED',
    'needs-review'
  );
}
