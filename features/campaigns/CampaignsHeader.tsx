'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface CampaignsHeaderProps {
  onOpenPacingModal?: () => void;
  onCreateCampaign?: () => void;
  metrics?: {
    running: number;
    scheduled: number;
    paused: number;
    completed: number;
  };
}

export const CampaignsHeader: React.FC<CampaignsHeaderProps> = ({
  onCreateCampaign,
  metrics,
}) => {
  const runningCount = metrics?.running ?? 0;
  const scheduledCount = metrics?.scheduled ?? 0;
  const pausedCount = metrics?.paused ?? 0;
  const completedCount = metrics?.completed ?? 0;

  const summaryItems = [
    { label: 'Running', value: runningCount, accent: 'text-primary' },
    { label: 'Scheduled', value: scheduledCount, accent: 'text-on-surface' },
    { label: 'Paused', value: pausedCount, accent: 'text-warning' },
    { label: 'Completed', value: completedCount, accent: 'text-on-surface' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="page-heading">Campaigns</h1>
            {runningCount > 0 && (
              <span className="rounded border border-primary/25 bg-accent-surface px-2 py-0.5 text-[11px] font-semibold text-primary">
                {runningCount} Active
              </span>
            )}
          </div>
          <p className="page-description">
            Create, schedule, and monitor autonomous Retell calling campaigns, Claude qualification, and Resend email follow-ups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCreateCampaign}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Row */}
      <div className="grid grid-cols-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between px-4 py-2.5">
            <span className="text-[12px] font-medium text-on-surface-variant">{item.label}</span>
            <span className={`font-mono text-[16px] font-semibold tabular-nums ${item.accent}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
