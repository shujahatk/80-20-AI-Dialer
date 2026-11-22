'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';

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
}

export const LeadsHeaderStrip: React.FC<LeadsHeaderStripProps> = ({
  metrics,
  onOpenImport,
  onAddLead,
  onExportCsv,
}) => {
  const cells = [
    { label: 'Total leads', value: metrics.totalLeads },
    { label: 'Contacted', value: metrics.contacted },
    { label: 'Qualified', value: metrics.qualified },
    { label: 'Do not call', value: metrics.dncRestricted },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="page-heading">Leads</h1>
          <p className="page-description">Contacts, suppliers, and outbound records in this workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onAddLead} className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-on-surface transition-colors hover:bg-surface-elevated" type="button">
            <Icon name="person_add" size={16} />
            Add lead
          </button>
          <button onClick={onExportCsv} className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-on-surface transition-colors hover:bg-surface-elevated" type="button">
            <Icon name="file_download" size={16} />
            Export CSV
          </button>
          <button id="openImportModalBtn" onClick={onOpenImport} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover" type="button">
            <Icon name="upload_file" size={16} />
            Import CSV
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-[#121614] xl:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="border-black/[0.06] p-4 dark:border-white/[0.06] xl:border-r xl:last:border-r-0">
            <p className="text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">{cell.label}</p>
            <p className="mt-1 font-mono text-[22px] font-medium tabular-nums text-[#1c3128] dark:text-neutral-50">{cell.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
