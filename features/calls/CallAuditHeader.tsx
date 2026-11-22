'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface CallAuditHeaderProps {
  onSearchChange?: (term: string) => void;
  onFilterOutcome?: (outcome: string) => void;
  onDateChange?: (date: string) => void;
}

export const CallAuditHeader: React.FC<CallAuditHeaderProps> = ({
  onSearchChange,
  onFilterOutcome,
  onDateChange,
}) => {
  const [activeDate, setActiveDate] = useState('All');
  const [activeOutcome, setActiveOutcome] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const outcomes = ['All', 'connected', 'no-answer', 'voicemail', 'failed', 'qualified'];
  const dates = ['All', 'Today', 'Last 7d', 'Month'];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm lg:flex-row lg:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="page-heading">
            Call history
          </h1>
          <p className="text-[14px] text-on-surface-variant">
            Review recorded outbound calls, transcripts, and qualification summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-border bg-surface-elevated p-1">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setActiveDate(d);
                  onDateChange?.(d);
                }}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-fast ${
                  activeDate === d
                    ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-secondary hover:text-on-surface'
                }`}
                type="button"
              >
                {d}
              </button>
            ))}
          </div>

          <div className="relative flex min-w-[240px] items-center">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 text-on-surface-muted" />
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                onSearchChange?.(e.target.value);
              }}
              placeholder="Search by contact or company..."
              className="w-full rounded-md border border-border bg-surface-elevated py-2 pl-9 pr-3 text-[14px] text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              type="search"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[13px]">
        {outcomes.map((o) => (
          <button
            key={o}
            onClick={() => {
              setActiveOutcome(o);
              onFilterOutcome?.(o);
            }}
            className={`whitespace-nowrap rounded-md border px-3.5 py-1.5 capitalize transition-colors duration-fast ${
              activeOutcome === o
                ? 'border-primary bg-primary font-semibold text-primary-foreground'
                : 'border-border bg-surface text-on-surface-variant hover:bg-surface-elevated hover:text-on-surface'
            }`}
            type="button"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
};
