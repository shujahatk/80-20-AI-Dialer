import type { QualificationModel } from './types';

export interface QualificationCompletenessResult {
  isQualified: boolean;
  scorePercent: number;
  completedFields: string[];
  missingCriticalFields: string[];
  requiresHumanHandoff: boolean;
  recommendedDisposition: 'qualified' | 'interested' | 'callback' | 'appointment' | 'not_interested' | 'dnc';
}

export function createInitialQualificationModel(): QualificationModel {
  return {
    decisionMakerIdentified: null,
    decisionMakerName: null,
    decisionMakerRole: null,
    materialAvailable: null,
    materialType: null,
    materialDescription: null,
    estimatedVolume: null,
    volumeUnit: null,
    frequency: null,
    location: null,
    timing: null,
    currentDisposalProcess: null,
    currentSupplierOrBuyer: null,
    interestLevel: null,
    callbackRequested: false,
    callbackTime: null,
    appointmentRequested: false,
    emailRequested: false,
    humanHandoffRequired: false,
  };
}

/**
 * Merges new qualification updates safely without overwriting established values with null
 */
export function mergeQualificationUpdates(
  current: QualificationModel,
  updates: Partial<QualificationModel>
): QualificationModel {
  const merged = { ...current };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined) {
      (merged as any)[key] = value;
    }
  }

  return merged;
}

/**
 * Assesses qualification completeness against critical RM criteria
 */
export function evaluateQualificationCompleteness(
  qualification: QualificationModel
): QualificationCompletenessResult {
  const completedFields: string[] = [];
  const missingCriticalFields: string[] = [];

  // Critical Criteria:
  // 1. Decision Maker Identified
  if (qualification.decisionMakerIdentified === true || qualification.decisionMakerName) {
    completedFields.push('Decision Maker');
  } else {
    missingCriticalFields.push('Decision Maker');
  }

  // 2. Material / Opportunity Identified
  if (qualification.materialAvailable === true || qualification.materialType) {
    completedFields.push('Material Type');
  } else {
    missingCriticalFields.push('Material Type');
  }

  // 3. Volume or Frequency
  if (qualification.estimatedVolume !== null || qualification.frequency) {
    completedFields.push('Volume / Frequency');
  } else {
    missingCriticalFields.push('Volume / Frequency');
  }

  // 4. Interest Level
  if (qualification.interestLevel) {
    completedFields.push('Interest Level');
  } else {
    missingCriticalFields.push('Interest Level');
  }

  const scorePercent = Math.round((completedFields.length / 4) * 100);
  const isQualified =
    completedFields.length >= 3 &&
    (qualification.interestLevel === 'high' || qualification.interestLevel === 'medium');

  let recommendedDisposition: QualificationCompletenessResult['recommendedDisposition'] = 'interested';

  if (qualification.interestLevel === 'none') {
    recommendedDisposition = 'not_interested';
  } else if (qualification.appointmentRequested) {
    recommendedDisposition = 'appointment';
  } else if (qualification.callbackRequested) {
    recommendedDisposition = 'callback';
  } else if (isQualified) {
    recommendedDisposition = 'qualified';
  }

  return {
    isQualified,
    scorePercent,
    completedFields,
    missingCriticalFields,
    requiresHumanHandoff: Boolean(qualification.humanHandoffRequired),
    recommendedDisposition,
  };
}
