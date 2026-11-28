'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api/client';
import { LeadsHeaderStrip } from '@/features/leads/LeadsHeaderStrip';
import { LeadsFiltersBar } from '@/features/leads/LeadsFiltersBar';
import { BulkSelectionBanner } from '@/features/leads/BulkSelectionBanner';
import { LeadsTable } from '@/features/leads/LeadsTable';
import { LeadsKanban } from '@/features/leads/LeadsKanban';
import { DeleteLeadModal } from '@/features/leads/DeleteLeadModal';
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

  if (actionParam === 'import') {
    return <CsvImportStudio />;
  }

  if (actionParam === 'new') {
    return <AddLeadStudio />;
  }

  return (
    <LeadsMainTable
      key={`${initialStatusParam || 'all'}-${initialSearchParam || 'all'}`}
      initialStatus={initialStatusParam}
      initialSearch={initialSearchParam}
    />
  );
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
      ? 'qualified'
      : initialStatus === 'callback'
      ? 'contacted'
      : 'All'
  );
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [availableCampaigns, setAvailableCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [priority, setPriority] = useState('All');
  const [dncFilter, setDncFilter] = useState<'all' | 'callable' | 'dnc'>(
    initialStatus === 'dnc' ? 'dnc' : 'all'
  );
  const [selectedTag, setSelectedTag] = useState('All');
  const [source, setSource] = useState('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<string | null>(null);
  const [drawerInitialEditMode, setDrawerInitialEditMode] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'board'>('table');

  useEffect(() => {
    setStatus(
      initialStatus === 'qualified'
        ? 'qualified'
        : initialStatus === 'callback'
        ? 'contacted'
        : 'All'
    );
    setDncFilter(initialStatus === 'dnc' ? 'dnc' : 'all');
    setSearch(initialSearch || '');
    setDebouncedSearch(initialSearch || '');
    setCurrentPage(1);
  }, [initialStatus, initialSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    authenticatedFetch('/api/campaigns?limit=50')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setAvailableCampaigns(
            json.data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
          );
        }
      })
      .catch(() => null);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(perPage),
      });

      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (status && status.toLowerCase() !== 'all') params.set('status', status.toLowerCase());
      if (priority && priority.toLowerCase() !== 'all') params.set('priority', priority);
      if (dncFilter === 'dnc') params.set('isDnc', 'true');
      if (dncFilter === 'callable') params.set('isDnc', 'false');
      if (source && source.toLowerCase() !== 'all') params.set('source', source);

      const res = await authenticatedFetch(`/api/leads?${params.toString()}`);
      if (res.status === 401) {
        setLeads([]);
        setTotalCount(0);
        setTotalPages(1);
        showToast('Session expired. Redirecting to sign in...');
        router.push('/login?redirectTo=/leads');
        return;
      }

      const data = await res.json();

      if (data.success) {
        setLeads(Array.isArray(data.data) ? data.data : []);
        setTotalCount(Number(data.totalCount) || 0);
        setTotalPages(Number(data.totalPages) || 1);
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
      showToast('Could not connect to CRM backend. Please refresh.');
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
    setCampaignFilter('All');
    setPriority('All');
    setDncFilter('all');
    setSelectedTag('All');
    setSource('All');
    setCurrentPage(1);
    router.push('/leads');
  };

  const availableTags = Array.from(
    new Set(leads.flatMap((l) => l.tags || []))
  ).filter(Boolean);

  const displayedLeads = leads.filter((l) => {
    if (selectedTag !== 'All' && !(l.tags || []).includes(selectedTag)) return false;
    if (campaignFilter !== 'All') {
      if (campaignFilter === 'unassigned') {
        if (l.campaignId) return false;
      } else if (l.campaignId !== campaignFilter) {
        return false;
      }
    }
    return true;
  });

  const handleSelectLead = (id: string, selected: boolean) => {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === displayedLeads.length && displayedLeads.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedLeads.map((l) => l.id));
    }
  };

  const handleInstantDial = (lead: Lead) => {
    if (lead.status === 'dnc' || lead.isDnc) {
      showToast(`Cannot dial ${lead.name}: Prospect is marked Do-Not-Call (DNC).`);
      return;
    }
    showToast(`Opening dialer workstation for ${lead.name}...`);
    router.push(`/workstation?leadId=${encodeURIComponent(lead.id)}&dial=${encodeURIComponent(lead.phone)}&autodial=true`);
  };

  const handleConfirmSingleDelete = async () => {
    if (!leadToDelete) return;
    setIsDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/leads/${leadToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Deleted "${leadToDelete.name}" from active CRM.`);
        setSelectedIds((prev) => prev.filter((id) => id !== leadToDelete.id));
        if (selectedLeadIdForDrawer === leadToDelete.id) {
          setSelectedLeadIdForDrawer(null);
        }
        setLeadToDelete(null);
        await fetchLeads();
      } else {
        showToast(data.error || 'Could not delete lead.');
      }
    } catch {
      showToast('Failed to delete lead.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      const res = await authenticatedFetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          leadIds: selectedIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const count = selectedIds.length;
        showToast(`Deleted ${count} ${count === 1 ? 'lead' : 'leads'} from active CRM.`);
        setSelectedIds([]);
        setIsBulkDeleteModalOpen(false);
        await fetchLeads();
      } else {
        showToast(data.error || 'Could not delete selected leads.');
      }
    } catch {
      showToast('Failed to perform bulk delete operation.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDnc = async () => {
    if (selectedIds.length === 0) return;
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
        showToast(`Marked ${selectedIds.length} leads as Do Not Call.`);
        setSelectedIds([]);
        fetchLeads();
      } else {
        showToast(data.error || 'Failed to update DNC status');
      }
    } catch {
      showToast('Failed to perform bulk DNC operation');
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
        showToast('Lead qualification stage updated');
        fetchLeads();
      }
    } catch {
      showToast('Could not update lead stage');
    }
  };

  return (
    <PageShell wide>
      <div className="relative flex flex-col gap-3.5">
        {/* Header & Compact Summary Row */}
        <LeadsHeaderStrip
          metrics={metrics}
          onOpenImport={() => setIsImportOpen(true)}
          onAddLead={() => setIsAddLeadOpen(true)}
          onExportCsv={handleExportCsv}
          onRefresh={fetchLeads}
          isRefreshing={isLoading}
        />

        {/* Compact Search & Filter Toolbar */}
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
          campaignFilter={campaignFilter}
          onCampaignFilterChange={(val) => {
            setCampaignFilter(val);
            setCurrentPage(1);
          }}
          availableCampaigns={availableCampaigns}
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
              { id: 'table', label: 'Table View' },
              { id: 'board', label: 'Pipeline Board' },
            ]}
          />
          <span className="text-[12px] text-on-surface-variant">
            {displayedLeads.length} shown · {totalCount} total leads
          </span>
        </div>

        {/* Bulk Selection Action Bar */}
        <BulkSelectionBanner
          selectedCount={selectedIds.length}
          totalMatched={totalCount}
          onMarkDnc={handleBulkDnc}
          onDeleteSelected={() => setIsBulkDeleteModalOpen(true)}
          onClearSelection={() => setSelectedIds([])}
          onExport={handleExportCsv}
        />

        {view === 'board' ? (
          <LeadsKanban
            leads={displayedLeads}
            isLoading={isLoading}
            onViewLead={(id) => {
              setDrawerInitialEditMode(false);
              setSelectedLeadIdForDrawer(id);
            }}
            onStatusChange={handleKanbanStatus}
          />
        ) : (
          <LeadsTable
            leads={displayedLeads}
            selectedIds={selectedIds}
            onSelectLead={handleSelectLead}
            onSelectAll={handleSelectAll}
            onInstantDial={handleInstantDial}
            onViewLead={(id) => {
              setDrawerInitialEditMode(false);
              setSelectedLeadIdForDrawer(id);
            }}
            onEditLead={(lead) => {
              setDrawerInitialEditMode(true);
              setSelectedLeadIdForDrawer(lead.id);
            }}
            onDeleteLead={(lead) => setLeadToDelete(lead)}
            onArchiveLead={(lead) => setLeadToDelete(lead)}
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

        {/* Lead Detail & Edit Drawer */}
        <LeadDrawer
          leadId={selectedLeadIdForDrawer}
          initialEditMode={drawerInitialEditMode}
          onClose={() => {
            setSelectedLeadIdForDrawer(null);
            setDrawerInitialEditMode(false);
          }}
          onLeadUpdated={() => fetchLeads()}
          onInstantDial={handleInstantDial}
          onRequestDelete={(lead) => setLeadToDelete(lead)}
        />

        {/* Individual Delete Confirmation Modal */}
        <DeleteLeadModal
          isOpen={Boolean(leadToDelete)}
          lead={leadToDelete}
          isDeleting={isDeleting}
          onClose={() => {
            if (!isDeleting) setLeadToDelete(null);
          }}
          onConfirm={handleConfirmSingleDelete}
        />

        {/* Bulk Delete Confirmation Modal */}
        <DeleteLeadModal
          isOpen={isBulkDeleteModalOpen}
          bulkCount={selectedIds.length}
          isDeleting={isDeleting}
          onClose={() => {
            if (!isDeleting) setIsBulkDeleteModalOpen(false);
          }}
          onConfirm={handleConfirmBulkDelete}
        />

        {/* Add Lead Modal */}
        <AddLeadModal
          isOpen={isAddLeadOpen}
          onClose={() => setIsAddLeadOpen(false)}
          onLeadCreated={() => {
            showToast('Lead created successfully');
            fetchLeads();
          }}
        />

        {/* CSV Import Modal */}
        <CsvImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportComplete={(count) => {
            if (count > 0) {
              showToast(`Imported ${count} leads into CRM.`);
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
    <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading Leads...</div>}>
      <LeadsContent />
    </Suspense>
  );
}
