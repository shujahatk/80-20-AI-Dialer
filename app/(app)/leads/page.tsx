'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api/client';
import { LeadsHeaderStrip } from '@/features/leads/LeadsHeaderStrip';
import { LeadsFiltersBar } from '@/features/leads/LeadsFiltersBar';
import { BulkSelectionBanner } from '@/features/leads/BulkSelectionBanner';
import { LeadsTable } from '@/features/leads/LeadsTable';
import { LeadsKanban } from '@/features/leads/LeadsKanban';
import { Tabs } from '@/components/ui/tabs';
import { Toast } from '@/components/ui/toast';
import { PageShell } from '@/components/ui/page-shell';
import { CsvImportModal } from '@/features/leads/CsvImportModal';
import { CsvImportStudio } from '@/features/leads/CsvImportStudio';
import { AddLeadStudio } from '@/features/leads/AddLeadStudio';
import { AddLeadModal } from '@/features/leads/AddLeadModal';
import { LeadDrawer } from '@/features/leads/LeadDrawer';
import type { Lead } from '@/types';

function LeadsContent() {
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action') || searchParams.get('view');
  const initialStatusParam = searchParams.get('status');
  const initialSearchParam = searchParams.get('search');

  // If action is import, show dedicated CSV upload interface
  if (actionParam === 'import') {
    return <CsvImportStudio />;
  }

  // If action is new, show dedicated Add Lead interface
  if (actionParam === 'new') {
    return <AddLeadStudio />;
  }

  return <LeadsMainTable initialStatus={initialStatusParam} initialSearch={initialSearchParam} />;
}

function LeadsMainTable({
  initialStatus,
  initialSearch,
}: {
  initialStatus?: string | null;
  initialSearch?: string | null;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    contacted: 0,
    qualified: 0,
    dncRestricted: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState(initialSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch || '');
  const [status, setStatus] = useState(
    initialStatus === 'qualified'
      ? 'Qualified'
      : initialStatus === 'callback'
      ? 'Callback Scheduled'
      : 'All'
  );
  const [priority, setPriority] = useState('All');
  const [dncFilter, setDncFilter] = useState<'all' | 'callable' | 'dnc'>(
    initialStatus === 'dnc' ? 'dnc' : 'all'
  );
  const [selectedTag, setSelectedTag] = useState('All');
  const [source, setSource] = useState('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'board'>('table');

  // Debounce search by 300ms to eliminate typing query storms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(perPage),
      });

      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (status && status !== 'All') params.set('status', status);
      if (priority && priority !== 'All') params.set('priority', priority);
      if (dncFilter === 'dnc') params.set('isDnc', 'true');
      if (dncFilter === 'callable') params.set('isDnc', 'false');
      if (source && source !== 'All') params.set('source', source);

      const res = await authenticatedFetch(`/api/leads?${params.toString()}`);
      if (res.status === 401) {
        setLeads([]);
        setTotalCount(0);
        setTotalPages(1);
        showToast('Session expired or unauthorized. Redirecting to sign in...');
        router.push('/login?redirectTo=/leads');
        return;
      }

      const data = await res.json();

      if (data.success) {
        setLeads(data.data);
        setTotalCount(data.totalCount);
        setTotalPages(data.totalPages);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      } else {
        setLeads([]);
        setTotalCount(0);
        setTotalPages(1);
        if (data.error) {
          showToast(`Error: ${data.error}`);
        }
      }
    } catch {
      setLeads([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, perPage, debouncedSearch, status, priority, dncFilter, source, router]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('All');
    setPriority('All');
    setDncFilter('all');
    setSelectedTag('All');
    setSource('All');
    setCurrentPage(1);
  };

  const availableTags = Array.from(
    new Set(leads.flatMap((l) => l.tags || []))
  ).filter(Boolean);

  const displayedLeads = selectedTag !== 'All'
    ? leads.filter((l) => (l.tags || []).includes(selectedTag))
    : leads;

  const handleSelectLead = (id: string, selected: boolean) => {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map((l) => l.id));
    }
  };

  const handleInstantDial = (lead: Lead) => {
    if (lead.status === 'dnc' || (lead as { is_dnc?: boolean }).is_dnc) {
      showToast(`Cannot dial ${lead.name}: Prospect is strictly marked Do-Not-Call (DNC).`);
      return;
    }
    showToast(`Connecting autonomous dialer for ${lead.name}...`);
    router.push(`/workstation?leadId=${encodeURIComponent(lead.id)}&dial=${encodeURIComponent(lead.phone)}&autodial=true`);
  };

  const handleBulkDnc = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Mark ${selectedIds.length} selected leads as Do-Not-Call (DNC)?`)) return;

    try {
      const res = await authenticatedFetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dnc',
          leadIds: selectedIds,
          dncReason: 'Bulk Do-Not-Call requested by operator',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Marked ${selectedIds.length} leads as DNC restricted.`);
        setSelectedIds([]);
        fetchLeads();
      } else {
        showToast(data.error || 'Failed to perform bulk DNC operation');
      }
    } catch {
      showToast('Failed to perform bulk DNC operation');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Archive ${selectedIds.length} selected leads? They will be safely hidden from active queues.`)) return;

    try {
      const res = await authenticatedFetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'archive',
          leadIds: selectedIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Safely archived ${selectedIds.length} leads.`);
        setSelectedIds([]);
        fetchLeads();
      } else {
        showToast(data.error || 'Failed to perform bulk archive operation');
      }
    } catch {
      showToast('Failed to perform bulk archive operation');
    }
  };

  const handleExportCsv = () => {
    window.location.href = '/api/leads/export';
  };

  const handleKanbanStatus = async (leadId: string, apiStatus: string) => {
    try {
      const res = await authenticatedFetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: apiStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Lead stage updated');
        fetchLeads();
      }
    } catch {
      showToast('Could not update lead stage');
    }
  };

  return (
    <PageShell wide>
      <div className="relative flex flex-col gap-5">
        {/* Metric & Action Strip */}
        <LeadsHeaderStrip
          metrics={metrics}
          onOpenImport={() => setIsImportOpen(true)}
          onAddLead={() => setIsAddLeadOpen(true)}
          onExportCsv={handleExportCsv}
        />

        {/* Advanced Filter & Control Bar */}
        <LeadsFiltersBar
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          status={status}
          onStatusChange={(val) => {
            setStatus(val);
            setCurrentPage(1);
          }}
          priority={priority}
          onPriorityChange={(val) => {
            setPriority(val);
            setCurrentPage(1);
          }}
          dncFilter={dncFilter}
          onDncFilterChange={(val) => {
            setDncFilter(val);
            setCurrentPage(1);
          }}
          selectedTag={selectedTag}
          onTagChange={(val) => {
            setSelectedTag(val);
            setCurrentPage(1);
          }}
          availableTags={availableTags}
          source={source}
          onSourceChange={(val) => {
            setSource(val);
            setCurrentPage(1);
          }}
          onClearAll={handleClearFilters}
        />

        <div className="flex items-center justify-between">
          <Tabs
            value={view}
            onChange={(id) => setView(id as 'table' | 'board')}
            items={[
              { id: 'table', label: 'Table' },
              { id: 'board', label: 'Board' },
            ]}
          />
        </div>

        {/* Bulk Selection Banner */}
        <BulkSelectionBanner
          selectedCount={selectedIds.length}
          totalMatched={totalCount}
          onDialSelected={() => {
            showToast(`Queuing ${selectedIds.length} leads into AI dialer queue...`);
          }}
          onMarkDnc={handleBulkDnc}
          onArchive={handleBulkArchive}
          onExport={handleExportCsv}
        />

        {view === 'board' ? (
          <LeadsKanban
            leads={displayedLeads}
            isLoading={isLoading}
            onViewLead={(id) => setSelectedLeadIdForDrawer(id)}
            onStatusChange={handleKanbanStatus}
          />
        ) : (
          <LeadsTable
            leads={displayedLeads}
            selectedIds={selectedIds}
            onSelectLead={handleSelectLead}
            onSelectAll={handleSelectAll}
            onInstantDial={handleInstantDial}
            onViewLead={(id) => setSelectedLeadIdForDrawer(id)}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            perPage={perPage}
            onPageChange={(page) => setCurrentPage(page)}
            onPerPageChange={(limit) => {
              setPerPage(limit);
              setCurrentPage(1);
            }}
            isLoading={isLoading}
          />
        )}

        {/* Slide-over Detail Drawer */}
        <LeadDrawer
          leadId={selectedLeadIdForDrawer}
          onClose={() => setSelectedLeadIdForDrawer(null)}
          onLeadUpdated={() => fetchLeads()}
          onInstantDial={handleInstantDial}
        />

        {/* Add Lead Modal */}
        <AddLeadModal
          isOpen={isAddLeadOpen}
          onClose={() => setIsAddLeadOpen(false)}
          onLeadCreated={() => {
            showToast('Lead record created successfully');
            fetchLeads();
          }}
        />

        {/* Interactive CSV Import Studio Modal */}
        <CsvImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportComplete={(count) => {
            if (count > 0) {
              showToast(`Successfully imported ${count} leads into CRM.`);
            } else {
              showToast('Import completed: No new leads added (duplicates or invalid rows).');
            }
            fetchLeads();
          }}
        />

        <Toast message={toastMessage || ''} />
      </div>
    </PageShell>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading Leads Workspace...</div>}>
      <LeadsContent />
    </Suspense>
  );
}
