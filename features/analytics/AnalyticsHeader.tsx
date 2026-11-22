'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface AnalyticsHeaderProps {
  onExport?: () => void;
}

export function AnalyticsHeader({ onExport }: AnalyticsHeaderProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7D' | '30D' | 'Q3 YTD' | 'Custom'>('30D');
  const [pipeline, setPipeline] = useState('All Outbound Pipelines');

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface p-6 rounded-xl border border-border shadow-sm">
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-[22px] font-bold text-on-surface tracking-tight truncate">
          Operations &amp; Performance Analytics
        </h1>
        <p className="text-[14px] text-on-surface-variant">
          Executive report on call connect rates, lead qualification, and conversion milestones.
        </p>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Selector Pills */}
        <div className="flex items-center bg-surface-elevated p-1 rounded-lg border border-border">
          {(['7D', '30D', 'Q3 YTD', 'Custom'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setSelectedTimeframe(period)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                selectedTimeframe === period
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-secondary'
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Campaign Filter */}
        <div className="relative">
          <select
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value)}
            className="appearance-none bg-surface-elevated hover:bg-surface-secondary text-on-surface text-[13px] font-medium pl-3 pr-8 py-2 rounded-md border border-border cursor-pointer outline-none"
          >
            <option>All Calling Campaigns</option>
            <option>Industrial Surplus Inbound</option>
            <option>Direct Recycling Outreach</option>
          </select>
          <Icon name="expand_more" size={18} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
        </div>

        {/* Export Action */}
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-on-primary text-[13px] font-semibold px-4 py-2 rounded-md transition-colors shadow-sm"
        >
          <Icon name="download" size={16} />
          <span>Export Report</span>
        </button>
      </div>
    </div>
  );
}
