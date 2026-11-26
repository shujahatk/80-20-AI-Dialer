'use client';

import React, { useMemo, useState } from 'react';
import type { Lead, LeadStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { leadStatusLabel, leadStatusTone, priorityLabel, priorityTone } from '@/lib/ui/status';

const COLUMNS: Array<{ id: string; title: string; statuses: LeadStatus[]; apiStatus: string }> = [
  { id: 'new', title: 'New', statuses: ['new'], apiStatus: 'new' },
  { id: 'queue', title: 'In queue', statuses: ['in-queue', 'dialing'], apiStatus: 'queued' },
  { id: 'contacted', title: 'Contacted', statuses: ['connected', 'voicemail-left', 'objection-handled'], apiStatus: 'contacted' },
  { id: 'needs-review', title: 'Needs Review', statuses: ['needs-review', 'needs_review', 'engaged'], apiStatus: 'needs-review' },
  { id: 'qualified', title: 'Qualified', statuses: ['qualified'], apiStatus: 'qualified' },
  { id: 'meeting', title: 'Meeting', statuses: ['meeting-booked'], apiStatus: 'converted' },
  { id: 'followup', title: 'Follow-up', statuses: ['callback-scheduled'], apiStatus: 'contacted' },
  { id: 'closed', title: 'Closed', statuses: ['dnc', 'unreachable'], apiStatus: 'unqualified' },
];

interface LeadsKanbanProps {
  leads: Lead[];
  isLoading?: boolean;
  onViewLead: (id: string) => void;
  onStatusChange?: (leadId: string, apiStatus: string) => Promise<void> | void;
}

export const LeadsKanban: React.FC<LeadsKanbanProps> = ({
  leads,
  isLoading,
  onViewLead,
  onStatusChange,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return COLUMNS.map((column) => ({
      ...column,
      items: leads.filter((lead) => column.statuses.includes(lead.status)),
    }));
  }, [leads]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {grouped.map((column) => (
        <section
          key={column.id}
          className={`flex min-w-[240px] max-w-[280px] flex-1 flex-col rounded-xl border bg-surface-elevated transition-colors duration-200 ${draggingId ? 'border-primary/30' : 'border-border'}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggingId && onStatusChange) {
              void onStatusChange(draggingId, column.apiStatus);
            }
            setDraggingId(null);
          }}
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
              {column.title}
            </span>
            <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-on-surface">
              {column.items.length}
            </span>
          </header>
          <div className="flex flex-1 flex-col gap-2 p-2">
            {isLoading ? (
              <div className="p-4 text-[12px] text-on-surface-muted">Loading...</div>
            ) : column.items.length === 0 ? (
              <div className="px-2 py-8 text-center text-[12px] text-on-surface-muted">No leads</div>
            ) : (
              column.items.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  draggable
                  onDragStart={() => setDraggingId(lead.id)}
                  onClick={() => onViewLead(lead.id)}
                  className={`rounded-lg border border-border bg-surface p-3 text-left shadow-xs transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:shadow-sm ${draggingId === lead.id ? 'scale-[0.98] opacity-60' : ''}`}
                >
                  <div className="truncate text-[13.5px] font-semibold text-on-surface">{lead.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-on-surface-variant">{lead.company}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
                    <Badge tone={priorityTone(lead.priority)}>{priorityLabel(lead.priority)}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
};
