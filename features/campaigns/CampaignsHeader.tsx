'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';

interface CampaignsHeaderProps {
  onOpenPacingModal: () => void;
  onCreateCampaign?: () => void;
  metrics?: {
    running: number;
    scheduled: number;
    paused: number;
    completed: number;
  };
}

export const CampaignsHeader: React.FC<CampaignsHeaderProps> = ({
  onOpenPacingModal,
  onCreateCampaign,
  metrics,
}) => {
  const runningCount = metrics?.running ?? 0;
  const scheduledCount = metrics?.scheduled ?? 0;
  const pausedCount = metrics?.paused ?? 0;
  const completedCount = metrics?.completed ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Title & Actions */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="page-heading">
              Calling Campaigns
            </h1>
            {runningCount > 0 && (
              <span className="rounded border border-success/20 bg-success-surface px-2.5 py-0.5 text-[12px] font-semibold text-success">
                {runningCount} running
              </span>
            )}
          </div>
          <p className="page-description">
            Configure outbound calling schedules, lead batches, and persona assignments.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onOpenPacingModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-surface hover:bg-surface-secondary text-on-surface text-[13px] font-semibold transition-colors border border-border shadow-sm"
            type="button"
          >
            <Icon name="speed" size={16} className="text-primary" />
            <span>Calling Schedule &amp; Rate</span>
          </button>

          <button
            onClick={onCreateCampaign}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-on-primary hover:bg-primary-hover text-[13px] font-semibold transition-colors shadow-sm"
            type="button"
          >
            <Icon name="add_call" size={16} />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Business Metric Cards */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-[#121614] md:grid-cols-4">
        {[
          ['Running', runningCount],
          ['Scheduled', scheduledCount],
          ['Paused', pausedCount],
          ['Completed', completedCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="p-4 md:border-r md:border-black/[0.06] md:last:border-r-0 dark:md:border-white/[0.06]">
            <span className="text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
            <div className="mt-1 font-mono text-[22px] font-medium tabular-nums text-[#1c3128] dark:text-neutral-50">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
