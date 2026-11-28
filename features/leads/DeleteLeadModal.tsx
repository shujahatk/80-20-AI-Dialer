'use client';

import React from 'react';
import type { Lead } from '@/types';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteLeadModalProps {
  isOpen: boolean;
  lead?: Lead | null;
  bulkCount?: number;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteLeadModal: React.FC<DeleteLeadModalProps> = ({
  isOpen,
  lead,
  bulkCount = 0,
  isDeleting = false,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const isBulk = !lead && bulkCount > 0;
  const title = isBulk
    ? `Delete ${bulkCount} Selected ${bulkCount === 1 ? 'Lead' : 'Leads'}`
    : 'Delete Lead';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 rm-overlay rm-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-lead-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-lg rm-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-error/25 bg-error-surface text-error">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 id="delete-lead-modal-title" className="text-[15px] font-semibold text-on-surface">
                {title}
              </h2>
              <p className="text-[12px] text-on-surface-variant">
                Confirm removal from active CRM lists
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close confirmation dialog"
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-secondary hover:text-on-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-[13px] leading-relaxed text-on-surface-variant">
          {lead ? (
            <div className="rounded-lg border border-border bg-surface-secondary/60 px-3.5 py-2.5">
              <div className="font-semibold text-on-surface">{lead.name}</div>
              {lead.company && lead.company !== '—' && (
                <div className="text-[12px] text-on-surface-variant">{lead.company}</div>
              )}
              {lead.phone && (
                <div className="mt-0.5 font-mono text-[11.5px] text-on-surface-variant">{lead.phone}</div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface-secondary/60 px-3.5 py-2.5 font-medium text-on-surface">
              {bulkCount} {bulkCount === 1 ? 'lead is' : 'leads are'} selected for deletion.
            </div>
          )}

          <p>
            {isBulk
              ? `These ${bulkCount} leads will be removed from the active CRM and excluded from all future campaign calling queues.`
              : `"${lead?.name}" will be removed from the active CRM and excluded from all future campaign calling queues.`}
          </p>
          <p className="text-[12px] text-on-surface-muted">
            Historical call sessions, transcripts, recordings, and campaign audit records are safely preserved. Leads with a live call in progress cannot be deleted until the call finishes.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-3.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="h-8 rounded-md border border-border bg-surface px-3.5 text-[12.5px] font-medium text-on-surface transition-colors hover:bg-surface-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-error px-3.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>
              {isDeleting
                ? 'Deleting...'
                : isBulk
                ? `Delete ${bulkCount} ${bulkCount === 1 ? 'Lead' : 'Leads'}`
                : 'Delete Lead'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
