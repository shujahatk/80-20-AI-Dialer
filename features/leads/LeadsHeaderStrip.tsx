'use client';

import React from 'react';
import { UserPlus, Upload, Download, RefreshCw } from 'lucide-react';

interface LeadsHeaderStripProps {
  metrics: {
    totalLeads: number;
    contacted: number;
    qualified: number;
    dncRestricted: number;
  };
  onOpenImport: () => void;
  onAddLead?: () => void;
  onExportCsv?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const LeadsHeaderStrip: React.FC<LeadsHeaderStripProps> = ({
  metrics,
  onOpenImport,
  onAddLead,
  onExportCsv,
  onRefresh,
  isRefreshing,
}) => {
  const summaryItems = [
    { label: 'Total Leads', value: metrics.totalLeads, accent: 'text-on-surface' },
    { label: 'Contacted', value: metrics.contacted, accent: 'text-on-surface' },
    { label: 'Qualified', value: metrics.qualified, accent: 'text-primary' },
    { label: 'Do Not Call', value: metrics.dncRestricted, accent: 'text-error' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Compact Header Row */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="page-heading">Leads</h1>
          <p className="page-description">
            Manage B2B contacts, qualification status, call outcomes, and campaign enrollment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh leads"
              aria-label="Refresh leads"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-on-surface-variant transition-colors hover:bg-surface-secondary hover:text-on-surface disabled:opacity-50"
              type="button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={onExportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12.5px] font-medium text-on-surface transition-colors hover:bg-surface-secondary"
            type="button"
          >
            <Download className="h-3.5 w-3.5 text-on-surface-variant" />
            <span>Export CSV</span>
          </button>
          <button
            id="openImportModalBtn"
            onClick={onOpenImport}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12.5px] font-medium text-on-surface transition-colors hover:bg-surface-secondary"
            type="button"
          >
            <Upload className="h-3.5 w-3.5 text-primary" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={onAddLead}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            type="button"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Bar */}
      <div className="grid grid-cols-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between px-4 py-2.5">
            <span className="text-[12px] font-medium text-on-surface-variant">{item.label}</span>
            <span className={`font-mono text-[16px] font-semibold tabular-nums ${item.accent}`}>
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
