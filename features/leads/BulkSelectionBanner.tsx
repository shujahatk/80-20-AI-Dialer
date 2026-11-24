'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';

interface BulkSelectionBannerProps {
  selectedCount?: number;
  totalMatched?: number;
  onDialSelected?: () => void;
  onChangeCampaign?: () => void;
  onExport?: () => void;
  onMarkDnc?: () => void;
  onArchive?: () => void;
  onSelectAllMatched?: () => void;
}

export const BulkSelectionBanner: React.FC<BulkSelectionBannerProps> = ({
  selectedCount = 0,
  totalMatched = 0,
  onDialSelected,
  onExport,
  onMarkDnc,
  onArchive,
  onSelectAllMatched,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="px-5 py-3 rounded-xl bg-accent-surface flex flex-wrap items-center justify-between gap-4 border border-primary/20 shadow-sm animate-in fade-in">
      <div className="flex items-center gap-3">
        <span className="text-[14px] text-on-surface">
          <strong className="font-bold text-primary">{selectedCount} leads</strong> selected
        </span>
        {totalMatched > selectedCount && onSelectAllMatched && (
          <button
            onClick={onSelectAllMatched}
            className="text-primary text-[13px] font-medium underline hover:text-primary-hover"
            type="button"
          >
            Select all {totalMatched.toLocaleString()} matched
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {onDialSelected && (
          <button
            onClick={onDialSelected}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary-hover transition-colors shadow-sm"
            type="button"
          >
            <Icon name="phone_in_talk" size={16} />
            <span>Dial Selected</span>
          </button>
        )}

        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface text-on-surface text-[13px] font-medium hover:bg-surface-elevated border border-border"
            type="button"
          >
            <Icon name="download" size={16} />
            <span>Export CSV</span>
          </button>
        )}

        {onMarkDnc && (
          <button
            onClick={onMarkDnc}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-error/15 text-error text-[13px] font-semibold hover:bg-error/25 border border-error/30"
            type="button"
          >
            <Icon name="do_not_disturb_on" size={16} />
            <span>Mark DNC</span>
          </button>
        )}

        {onArchive && (
          <button
            onClick={onArchive}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface-secondary text-on-surface-variant text-[13px] font-medium hover:bg-surface-elevated hover:text-on-surface border border-border"
            type="button"
          >
            <Icon name="archive" size={16} />
            <span>Archive</span>
          </button>
        )}
      </div>
    </div>
  );
};
