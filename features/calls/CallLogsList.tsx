'use client';

import React from 'react';
import type { Call } from '@/types';
import { Icon } from '@/lib/ui/icons';

interface CallLogsListProps {
  calls: Call[];
  selectedCallId: string;
  onSelectCall: (callId: string) => void;
}

export const CallLogsList: React.FC<CallLogsListProps> = ({
  calls,
  selectedCallId,
  onSelectCall,
}) => {
  const getOutcomeBadge = (outcome: Call['outcome'], label: string) => {
    switch (outcome) {
      case 'booked_meeting':
        return (
          <span className="px-2.5 py-0.5 rounded text-[12px] font-semibold bg-accent-surface text-primary border border-accent/20">
            {label}
          </span>
        );
      case 'qualified_followup':
        return (
          <span className="px-2.5 py-0.5 rounded text-[12px] font-semibold bg-accent-surface text-secondary border border-secondary/20">
            {label}
          </span>
        );
      case 'voicemail_dropped':
        return (
          <span className="px-2.5 py-0.5 rounded text-[12px] font-medium bg-surface-secondary text-on-surface-variant border border-border">
            {label}
          </span>
        );
      case 'callback_scheduled':
        return (
          <span className="px-2.5 py-0.5 rounded text-[12px] font-semibold bg-warning/15 text-warning border border-warning/20">
            {label}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded text-[12px] font-medium bg-surface-elevated text-on-surface border border-border">
            {label}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1 text-[13px] text-on-surface-variant">
        <span>Recorded Calls ({calls.length})</span>
        <span>Select to review</span>
      </div>

      {/* Call Cards List */}
      {calls.map((call) => {
        const isSelected = call.id === selectedCallId;

        return (
          <div
            key={call.id}
            onClick={() => onSelectCall(call.id)}
            className={`p-4 rounded-xl cursor-pointer transition-colors border ${
              isSelected
                ? 'bg-surface border-primary shadow-sm ring-1 ring-primary'
                : 'bg-surface hover:bg-surface-elevated border-border shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
                  <Icon name="phone" size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-bold text-on-surface truncate">
                    {call.leadName}
                  </span>
                  <span className="text-[13px] text-on-surface-variant truncate">
                    {call.company}
                  </span>
                </div>
              </div>

              {/* Outcome Badge */}
              {getOutcomeBadge(call.outcome, call.outcomeLabel)}
            </div>

            {/* Metadata Footer */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border text-[12px] text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span>{call.timestamp}</span>
                <span>•</span>
                <span>{call.durationFormatted}</span>
              </div>
              <span className="text-on-surface font-medium">{call.agentName}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
