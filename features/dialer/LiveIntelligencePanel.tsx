'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';
import type { QualificationModel, ConversationStage } from '@/services/ai/types';

interface LiveIntelligencePanelProps {
  confidencePercent?: number;
  currentStage?: ConversationStage | string;
  prospectIntent?: string;
  detectedObjection?: string;
  factsCaptured?: string | Record<string, unknown>;
  callGoal?: string;
  tacticalRecommendation?: string;
  qualification?: QualificationModel;
}

export const LiveIntelligencePanel: React.FC<LiveIntelligencePanelProps> = ({
  currentStage = 'opening',
  prospectIntent = 'Ready',
  factsCaptured = '',
  callGoal = 'Qualify the current lead',
  tacticalRecommendation,
  qualification,
}) => {
  const formattedFacts = typeof factsCaptured === 'string'
    ? factsCaptured
    : Object.entries(factsCaptured || {})
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`)
        .join('; ');

  return (
    <div className="rm-card flex flex-col gap-3.5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="psychology" size={20} className="text-primary" />
          <h3 className="text-[15px] font-bold text-on-surface">
            Sales Intelligence &amp; Qualification
          </h3>
        </div>
        <span className="px-2.5 py-0.5 rounded text-[12px] font-semibold uppercase tracking-wider bg-accent-surface text-primary border border-accent/20">
          {currentStage.replace('_', ' ')}
        </span>
      </div>

      <div className="flex flex-col gap-3 text-[14px]">
        {/* Qualification Status Badges */}
        {qualification && (
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-surface-elevated border border-border">
            <div className="flex flex-col text-center">
              <span className="text-[12px] text-on-surface-variant">Decision Maker</span>
              <span className={`text-[13px] font-bold ${qualification.decisionMakerIdentified ? 'text-success' : 'text-on-surface-muted'}`}>
                {qualification.decisionMakerIdentified ? 'Identified' : 'Pending'}
              </span>
            </div>
            <div className="flex flex-col text-center border-x border-border">
              <span className="text-[12px] text-on-surface-variant">Material</span>
              <span className={`text-[13px] font-bold ${qualification.materialAvailable ? 'text-success' : 'text-on-surface-muted'}`}>
                {qualification.materialType || (qualification.materialAvailable ? 'Yes' : 'Pending')}
              </span>
            </div>
            <div className="flex flex-col text-center">
              <span className="text-[12px] text-on-surface-variant">Est. Volume</span>
              <span className={`text-[13px] font-bold ${qualification.estimatedVolume ? 'text-success' : 'text-on-surface-muted'}`}>
                {qualification.estimatedVolume ? `${qualification.estimatedVolume} ${qualification.volumeUnit || ''}` : 'Pending'}
              </span>
            </div>
          </div>
        )}

        {/* Captured Information */}
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface-elevated border border-border">
          <span className="text-[12px] font-semibold text-primary uppercase tracking-wider flex items-center justify-between">
            <span>Captured Commercial Facts</span>
            <span className="text-[12px] text-on-surface-variant font-normal">{prospectIntent}</span>
          </span>
          <p className="text-on-surface leading-relaxed text-[14px] mt-1">
            {formattedFacts || 'No commercial facts captured yet.'}
          </p>
          {tacticalRecommendation ? (
            <p className="mt-2 text-[13px] text-on-surface-variant">{tacticalRecommendation}</p>
          ) : null}
        </div>

        {/* Call Objective */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-elevated border border-border text-[13px]">
          <span className="font-semibold text-on-surface-variant">Goal:</span>
          <span className="text-on-surface font-medium truncate max-w-[240px]">{callGoal}</span>
        </div>
      </div>
    </div>
  );
};
