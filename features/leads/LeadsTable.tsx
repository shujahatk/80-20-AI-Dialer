'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';
import type { Lead } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { leadStatusLabel, leadStatusTone, priorityLabel, priorityTone } from '@/lib/ui/status';

interface LeadsTableProps {
  leads: Lead[];
  selectedIds?: string[];
  onSelectLead?: (leadId: string, selected: boolean) => void;
  onSelectAll?: () => void;
  onInstantDial?: (lead: Lead) => void;
  onViewLead?: (leadId: string) => void;
  onArchiveLead?: (lead: Lead) => void;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  isLoading?: boolean;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  selectedIds = [],
  onSelectLead,
  onSelectAll,
  onInstantDial,
  onViewLead,
  onArchiveLead,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  perPage = 25,
  onPageChange,
  onPerPageChange,
  isLoading = false,
}) => {
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const formatEmailStatusBadge = (status?: string | null) => {
    if (!status) return <span className="text-xs text-on-surface-variant">—</span>;
    const s = status.toLowerCase();
    if (s === 'delivered' || s === 'accepted') {
      return <Badge tone="success">{s === 'delivered' ? 'Delivered' : 'Sent'}</Badge>;
    }
    if (s === 'queued' || s === 'pending' || s === 'sending' || s === 'retry') {
      return <Badge tone="info">Queued</Badge>;
    }
    if (s === 'bounced' || s === 'failed' || s === 'complained') {
      return <Badge tone="error">{s === 'bounced' ? 'Bounced' : 'Failed'}</Badge>;
    }
    if (s === 'suppressed') {
      return <Badge tone="warning">Skipped</Badge>;
    }
    return <Badge tone="neutral">{status}</Badge>;
  };

  const startIdx = (currentPage - 1) * perPage + 1;
  const endIdx = Math.min(totalCount, currentPage * perPage);

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-surface shadow-xs">
        <Table className="min-w-[1140px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <input
                  checked={selectedIds.length === leads.length && leads.length > 0}
                  onChange={onSelectAll}
                  className="h-4 w-4 cursor-pointer accent-primary"
                  type="checkbox"
                  aria-label="Select all leads"
                />
              </TableHead>
              <TableHead>Lead Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Phone &amp; Email</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead>Last Call &amp; Retries</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10}>
                  <TableSkeleton rows={8} cols={7} />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    title="No leads found"
                    description="Adjust filters or import a CSV to add contacts."
                  />
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedIds.includes(lead.id);
                const attempts = lead.attempts ?? 0;
                const maxAttempts = lead.maxAttempts ?? 3;
                const lastActivityDate = lead.lastCallDate || lead.updatedAt || lead.createdAt;
                return (
                  <TableRow
                    key={lead.id}
                    className={`cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-primary/[0.06]' : 'hover:bg-primary/[0.04]'}`}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (!target.closest('button') && !target.closest('input')) {
                        onViewLead?.(lead.id);
                      }
                    }}
                  >
                    <TableCell>
                      <input
                        checked={isSelected}
                        onChange={(event) => {
                          event.stopPropagation();
                          onSelectLead?.(lead.id, !isSelected);
                        }}
                        className="h-4 w-4 cursor-pointer accent-primary"
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-on-surface">{lead.name}</div>
                          <div className="truncate text-[12px] text-on-surface-variant">{lead.title || 'Contact'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-on-surface">{lead.company}</TableCell>
                    <TableCell className="min-w-[150px]">
                      <div className="tabular-nums font-medium text-on-surface">{lead.phone || '—'}</div>
                      <div className="truncate text-[11px] text-on-surface-variant">{lead.email || 'No email'}</div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs text-on-surface">
                      {lead.campaignName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-0.5 font-medium text-on-surface border border-border">
                          {lead.campaignName}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[170px]">
                      <div className="truncate text-xs font-medium text-on-surface">
                        {lead.lastOutcome || 'Not called'}
                      </div>
                      <div className="text-[11px] text-on-surface-variant">
                        Attempt {attempts} / {maxAttempts}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatEmailStatusBadge(lead.emailDeliveryStatus)}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs text-on-surface-variant">
                      {lastActivityDate ? new Date(lastActivityDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button
                          size="sm"
                          disabled={lead.status === 'dnc' || lead.isDnc}
                          onClick={() => onInstantDial?.(lead)}
                        >
                          <Icon name="call" size={14} />
                          Call
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View or Edit Lead"
                          onClick={() => onViewLead?.(lead.id)}
                        >
                          <Icon name="edit" size={15} />
                        </Button>
                        {onArchiveLead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Archive / Delete Lead"
                            onClick={() => onArchiveLead(lead)}
                          >
                            <Icon name="delete" size={15} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 px-1 text-[13px] text-on-surface-variant sm:flex-row">
        <div className="flex items-center gap-3">
          <span>
            Showing <span className="font-semibold text-on-surface">{totalCount > 0 ? startIdx : 0}</span> to{' '}
            <span className="font-semibold text-on-surface">{endIdx}</span> of{' '}
            <span className="font-semibold text-on-surface">{totalCount.toLocaleString()}</span>
          </span>
          <label className="flex items-center gap-1.5">
            Per page
            <select
              value={perPage}
              onChange={(event) => onPerPageChange?.(Number(event.target.value))}
              className="rounded-md border border-border bg-surface px-2 py-1 text-on-surface"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" disabled={currentPage <= 1 || isLoading} onClick={() => onPageChange?.(currentPage - 1)}>
            Previous
          </Button>
          <span className="px-2 font-medium text-on-surface">
            {currentPage} / {Math.max(1, totalPages)}
          </span>
          <Button variant="secondary" size="sm" disabled={currentPage >= totalPages || isLoading} onClick={() => onPageChange?.(currentPage + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
