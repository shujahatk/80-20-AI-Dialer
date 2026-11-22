'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';

interface ActiveQueuePanelProps {
  currentPosition?: number;
  totalQueue?: number;
  campaignName?: string;
  pendingCount?: number;
  upNextLead?: {
    name: string;
    title: string;
    phone: string;
    countdown?: string;
  };
  onSkip?: () => void;
}

export const ActiveQueuePanel: React.FC<ActiveQueuePanelProps> = ({
  currentPosition = 0,
  totalQueue = 0,
  campaignName = 'Direct outbound',
  pendingCount = 0,
  upNextLead,
  onSkip,
}) => {
  return (
    <div className="rm-card flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Icon name="format_list_bulleted" size={20} className="text-primary" />
          <h3 className="text-[15px] font-semibold text-on-surface">Calling queue</h3>
        </div>
        <span className="rounded bg-accent-surface px-2.5 py-0.5 text-[12px] font-semibold text-primary border border-accent/20">
          {pendingCount} pending
        </span>
      </div>

      <div className="flex items-center justify-between text-[13px] text-on-surface-variant">
        <span>Campaign</span>
        <span className="max-w-[180px] truncate font-medium text-on-surface">{campaignName}</span>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-elevated p-3">
        {upNextLead ? (
          <>
            <span className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Up next {currentPosition ? `(#${currentPosition + 1})` : ''}
            </span>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-on-surface">{upNextLead.name}</span>
              {upNextLead.countdown ? (
                <span className="text-[12px] text-on-surface-muted">{upNextLead.countdown}</span>
              ) : null}
            </div>
            {upNextLead.title ? (
              <span className="text-[13px] text-on-surface-variant">{upNextLead.title}</span>
            ) : null}
            {upNextLead.phone ? (
              <span className="text-[12px] tabular-nums text-on-surface-muted">{upNextLead.phone}</span>
            ) : null}
          </>
        ) : (
          <span className="text-[13px] text-on-surface-variant">
            {totalQueue === 0 ? 'No leads in the current queue.' : 'End of queue.'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-1">
        <button
          type="button"
          disabled={!upNextLead}
          onClick={onSkip}
          className="flex items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Skip to next lead</span>
          <Icon name="skip_next" size={16} />
        </button>
        <span className="text-[12px] text-on-surface-muted">
          {currentPosition && totalQueue ? `${currentPosition} of ${totalQueue}` : `${totalQueue} leads`}
        </span>
      </div>
    </div>
  );
};
