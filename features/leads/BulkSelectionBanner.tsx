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
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="px-5 py-3 rounded-xl bg-accent-surface flex flex-wrap items-center justify-between gap-4 border border-primary/20 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-[14px] text-on-surface">
          <strong className="font-bold text-primary">{selectedCount} leads</strong> selected
        </span>
        <button
          onClick={() => alert(`Selected all ${totalMatched.toLocaleString()} matched leads`)}
          className="text-primary text-[13px] font-medium underline hover:text-primary-hover"
          type="button"
        >
          Select all {totalMatched.toLocaleString()} matched
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onDialSelected ?? (() => alert(`Queuing ${selectedCount} leads into dialer.`))}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary-hover transition-colors shadow-sm"
          type="button"
        >
          <Icon name="phone_in_talk" size={16} />
          <span>Dial Selected</span>
        </button>

        <button
          onClick={onExport ?? (() => alert('Exporting selected records to CSV'))}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface text-on-surface text-[13px] font-medium hover:bg-surface-elevated border border-border"
          type="button"
        >
          <Icon name="download" size={16} />
          <span>Export</span>
        </button>

        <button
          onClick={onMarkDnc ?? (() => alert(`Marked ${selectedCount} leads as DNC.`))}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-error/15 text-error text-[13px] font-semibold hover:bg-error/25 border border-error/30"
          type="button"
        >
          <Icon name="do_not_disturb_on" size={16} />
          <span>Mark DNC</span>
        </button>
      </div>
    </div>
  );
};
