'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/lib/ui/icons';

interface DashboardHeaderProps {
  onToggleDiagnostics?: () => void;
  showDiagnostics?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onToggleDiagnostics,
  showDiagnostics,
}) => {
  const [activeDateTab, setActiveDateTab] = useState<'today' | '7d' | '30d'>('today');

  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-surface p-6 rounded-xl border border-border shadow-sm">
      {/* Title & Status */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-bold text-on-surface tracking-tight">
            Operations Overview
          </h1>
          <span className="px-2.5 py-0.5 rounded bg-success-surface text-success text-[12px] font-semibold border border-success/20">
            System Online
          </span>
        </div>
        <p className="text-[14px] text-on-surface-variant">
          Key performance metrics, outbound call outcomes, and lead qualification for RM Group.
        </p>
      </div>

      {/* Date Selectors & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Filter */}
        <div className="flex items-center bg-surface-elevated p-1 rounded-lg gap-1 border border-border">
          <button
            onClick={() => setActiveDateTab('today')}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              activeDateTab === 'today'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-secondary'
            }`}
            type="button"
          >
            Today
          </button>
          <button
            onClick={() => setActiveDateTab('7d')}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              activeDateTab === '7d'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-secondary'
            }`}
            type="button"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setActiveDateTab('30d')}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              activeDateTab === '30d'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-secondary'
            }`}
            type="button"
          >
            Last 30 Days
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onToggleDiagnostics && (
            <button
              onClick={onToggleDiagnostics}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                showDiagnostics
                  ? 'bg-surface-secondary text-on-surface border-border-strong'
                  : 'bg-surface text-on-surface-variant hover:text-on-surface border-border hover:bg-surface-elevated'
              }`}
              title="Toggle system diagnostics"
            >
              <Icon name="tune" size={16} />
              <span>Diagnostics</span>
            </button>
          )}

          <Link
            href="/leads"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-surface text-on-surface hover:bg-surface-elevated transition-colors text-[13px] font-semibold border border-border shadow-sm"
          >
            <Icon name="upload_file" size={16} className="text-primary" />
            <span>Import Leads</span>
          </Link>

          <Link
            href="/workstation"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary hover:bg-primary-hover text-on-primary transition-colors text-[13px] font-semibold shadow-sm"
          >
            <Icon name="phone_in_talk" size={16} />
            <span>Start Calling</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
