'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Lead } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { leadStatusLabel, leadStatusTone } from '@/lib/ui/status';
import { PhoneCall, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';

interface LeadsTableProps {
  leads: Lead[];
  selectedIds?: string[];
  onSelectLead?: (leadId: string, selected: boolean) => void;
  onSelectAll?: () => void;
  onInstantDial?: (lead: Lead) => void;
  onViewLead?: (leadId: string) => void;
  onEditLead?: (lead: Lead) => void;
  onArchiveLead?: (lead: Lead) => void;
  onDeleteLead?: (lead: Lead) => void;
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
  onEditLead,
  onArchiveLead,
  onDeleteLead,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  perPage = 25,
  onPageChange,
  onPerPageChange,
  isLoading = false,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const formatEmailStatusBadge = (status?: string | null) => {
    if (!status) return <span className="text-[12px] text-on-surface-muted">—</span>;
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

  const handleDeleteAction = (lead: Lead) => {
    setOpenMenuId(null);
    if (onDeleteLead) {
      onDeleteLead(lead);
    } else if (onArchiveLead) {
      onArchiveLead(lead);
    }
  };

  const startIdx = (currentPage - 1) * perPage + 1;
  const endIdx = Math.min(totalCount, currentPage * perPage);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <Table className="min-w-[1040px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <input
                  checked={selectedIds.length === leads.length && leads.length > 0}
                  onChange={onSelectAll}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                  type="checkbox"
                  aria-label="Select all leads on current page"
                />
              </TableHead>
              <TableHead>Lead Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact Information</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead>Last Call</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9}>
                  <TableSkeleton rows={6} cols={7} />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="No leads found"
                    description="Adjust filters, add a lead, or import a CSV to populate your CRM."
                  />
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedIds.includes(lead.id);
                const attempts = lead.attempts ?? 0;
                const maxAttempts = lead.maxAttempts ?? 3;
                const isMenuOpen = openMenuId === lead.id;

                return (
                  <TableRow
                    key={lead.id}
                    className={`cursor-pointer transition-colors duration-100 ${
                      isSelected ? 'bg-primary/[0.07]' : 'hover:bg-surface-secondary/50'
                    }`}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (!target.closest('button') && !target.closest('input') && !target.closest('[data-lead-menu]')) {
                        onViewLead?.(lead.id);
                      }
                    }}
                  >
                    <TableCell className="py-2.5">
                      <input
                        checked={isSelected}
                        onChange={(event) => {
                          event.stopPropagation();
                          onSelectLead?.(lead.id, !isSelected);
                        }}
                        className="h-3.5 w-3.5 cursor-pointer accent-primary"
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                      />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-accent-surface text-[10.5px] font-semibold text-primary">
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-on-surface">{lead.name}</div>
                          {lead.title && (
                            <div className="truncate text-[11.5px] text-on-surface-variant">{lead.title}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-[13px] font-medium text-on-surface">
                      {lead.company || '—'}
                    </TableCell>
                    <TableCell className="min-w-[160px] py-2.5">
                      <div className="font-mono text-[12.5px] tabular-nums text-on-surface">
                        {lead.phone || '—'}
                      </div>
                      <div className="truncate text-[11.5px] text-on-surface-variant">
                        {lead.email || 'No email'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate py-2.5 text-[12px]">
                      {lead.campaignName ? (
                        <span className="inline-flex items-center rounded border border-border bg-surface-secondary px-2 py-0.5 font-medium text-on-surface">
                          {lead.campaignName}
                        </span>
                      ) : (
                        <span className="text-on-surface-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[165px] py-2.5">
                      <div className="truncate text-[12.5px] font-medium text-on-surface">
                        {lead.lastOutcome || 'Not contacted'}
                      </div>
                      <div className="text-[11px] text-on-surface-muted">
                        {attempts > 0 ? `Attempt ${attempts} of ${maxAttempts}` : '0 attempts'}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {formatEmailStatusBadge(lead.emailDeliveryStatus)}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div
                        className="relative inline-flex items-center justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                        data-lead-menu
                      >
                        <button
                          type="button"
                          disabled={lead.status === 'dnc' || lead.isDnc}
                          onClick={() => onInstantDial?.(lead)}
                          title={lead.status === 'dnc' || lead.isDnc ? 'Do Not Call restricted' : `Call ${lead.name}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 text-[11.5px] font-medium text-on-surface transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <PhoneCall className="h-3 w-3" />
                          <span>Call</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if ( onEditLead ) {
                              onEditLead(lead);
                            } else {
                              onViewLead?.(lead.id);
                            }
                          }}
                          title="Edit Lead"
                          aria-label={`Edit ${lead.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-secondary hover:text-on-surface"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAction(lead)}
                          title="Delete Lead"
                          aria-label={`Delete ${lead.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-error-surface hover:text-error"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(isMenuOpen ? null : lead.id)}
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            aria-label={`Actions for ${lead.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-secondary hover:text-on-surface"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {isMenuOpen && (
                            <div
                              role="menu"
                              className="absolute right-0 top-full z-40 mt-1 w-40 rounded-lg border border-border bg-surface-elevated p-1 text-left text-[12.5px] shadow-lg rm-panel"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onViewLead?.(lead.id);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-on-surface hover:bg-surface-secondary"
                              >
                                <Eye className="h-3.5 w-3.5 text-on-surface-variant" />
                                <span>View Details</span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  if (onEditLead) {
                                    onEditLead(lead);
                                  } else {
                                    onViewLead?.(lead.id);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-on-surface hover:bg-surface-secondary"
                              >
                                <Pencil className="h-3.5 w-3.5 text-on-surface-variant" />
                                <span>Edit Lead</span>
                              </button>
                              <div className="my-1 border-t border-border/60" />
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleDeleteAction(lead)}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-error hover:bg-error-surface"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete Lead</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      {/* Compact Pagination Footer */}
      <div className="flex flex-col items-center justify-between gap-2 px-1 text-[12.5px] text-on-surface-variant sm:flex-row">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="font-semibold text-on-surface">{totalCount > 0 ? startIdx : 0}</strong>–
            <strong className="font-semibold text-on-surface">{endIdx}</strong> of{' '}
            <strong className="font-semibold text-on-surface">{totalCount.toLocaleString()}</strong>
          </span>
          <label className="flex items-center gap-1.5">
            <span>Rows</span>
            <select
              value={perPage}
              onChange={(event) => onPerPageChange?.(Number(event.target.value))}
              className="h-7 rounded border border-border bg-surface px-2 text-[12px] text-on-surface"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange?.(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="px-2 font-mono text-[12px] font-medium text-on-surface">
            {currentPage} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange?.(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
