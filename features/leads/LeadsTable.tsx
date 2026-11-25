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

  const startIdx = (currentPage - 1) * perPage + 1;
  const endIdx = Math.min(totalCount, currentPage * perPage);

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-surface shadow-xs">
        <Table className="min-w-[1080px]">
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
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Last contact</TableHead>
              <TableHead>Next action</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9}>
                  <TableSkeleton rows={8} cols={6} />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="No leads found"
                    description="Adjust filters or import a CSV to add contacts."
                  />
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedIds.includes(lead.id);
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
                          <div className="truncate text-[12px] text-on-surface-variant">{lead.title}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-on-surface">{lead.company}</TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="tabular-nums font-medium text-on-surface">{lead.phone || '—'}</div>
                      {lead.email && <div className="truncate text-[11px] text-on-surface-variant">{lead.email}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={priorityTone(lead.priority)}>{priorityLabel(lead.priority)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-on-surface-variant">
                      {lead.lastOutcome || 'Not contacted'}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-primary">
                      {lead.nextAction?.scheduledTime || lead.nextAction?.description || 'Ready to dial'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        <Button
                          size="sm"
                          disabled={lead.status === 'dnc'}
                          onClick={() => onInstantDial?.(lead)}
                        >
                          <Icon name="call" size={14} />
                          Call
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onViewLead?.(lead.id)}>
                          <Icon name="chevron_right" size={16} />
                        </Button>
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
