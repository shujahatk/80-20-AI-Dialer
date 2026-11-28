'use client';

import React from 'react';
import { Trash2, PhoneOff, Download, X } from 'lucide-react';

interface BulkSelectionBannerProps {
  selectedCount?: number;
  totalMatched?: number;
  onDialSelected?: () => void;
  onChangeCampaign?: () => void;
  onExport?: () => void;
  onMarkDnc?: () => void;
  onArchive?: () => void;
  onDeleteSelected?: () => void;
  onClearSelection?: () => void;
  onSelectAllMatched?: () => void;
}

export const BulkSelectionBanner: React.FC<BulkSelectionBannerProps> = ({
  selectedCount = 0,
  totalMatched = 0,
  onExport,
  onMarkDnc,
  onArchive,
  onDeleteSelected,
  onClearSelection,
  onSelectAllMatched,
}) => {
  if (selectedCount === 0) return null;

  const handleBulkDelete = onDeleteSelected || onArchive;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-accent-surface px-4 py-2.5 text-[12.5px] rm-fade">
      <div className="flex items-center gap-3">
        <span className="font-medium text-on-surface">
          <strong className="font-semibold text-primary">{selectedCount}</strong>{' '}
          {selectedCount === 1 ? 'lead' : 'leads'} selected
        </span>
        {totalMatched > selectedCount && onSelectAllMatched && (
          <button
            onClick={onSelectAllMatched}
            className="text-[12px] font-medium text-primary underline hover:text-primary-hover"
            type="button"
          >
            Select all {totalMatched.toLocaleString()}
          </button>
        )}
        {onClearSelection && (
          <button
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-on-surface-variant hover:text-on-surface"
            type="button"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear selection</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onExport && (
          <button
            onClick={onExport}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-on-surface hover:bg-surface-secondary"
            type="button"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
        )}

        {onMarkDnc && (
          <button
            onClick={onMarkDnc}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-on-surface hover:bg-surface-secondary"
            type="button"
          >
            <PhoneOff className="h-3.5 w-3.5 text-warning" />
            <span>Mark DNC</span>
          </button>
        )}

        {handleBulkDelete && (
          <button
            onClick={handleBulkDelete}
            title="Delete / Archive selected leads"
            className="inline-flex h-7.5 items-center gap-1.5 rounded-md border border-error/30 bg-error-surface px-3 py-1 text-[12px] font-semibold text-error transition-colors hover:bg-error hover:text-white"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Selected ({selectedCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};
