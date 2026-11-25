'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface LeadsFiltersBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  status?: string;
  onStatusChange?: (val: string) => void;
  priority?: string;
  onPriorityChange?: (val: string) => void;
  dncFilter?: 'all' | 'callable' | 'dnc';
  onDncFilterChange?: (val: 'all' | 'callable' | 'dnc') => void;
  selectedTag?: string;
  onTagChange?: (val: string) => void;
  availableTags?: string[];
  source?: string;
  onSourceChange?: (val: string) => void;
  onClearAll?: () => void;
}

export const LeadsFiltersBar: React.FC<LeadsFiltersBarProps> = ({
  search = '',
  onSearchChange,
  status = 'All',
  onStatusChange,
  dncFilter = 'all',
  onDncFilterChange,
  selectedTag = 'All',
  onTagChange,
  availableTags = [],
  source = 'All',
  onSourceChange,
  onClearAll,
}) => {
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const hasActiveFilters =
    search.trim() !== '' ||
    status !== 'All' ||
    dncFilter !== 'all' ||
    selectedTag !== 'All' ||
    source !== 'All';

  return (
    <div className="rm-card flex flex-col gap-3 p-4">
      {/* Primary Search & Core Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
        {/* Search Field (5 cols) */}
        <div className="lg:col-span-5 relative">
          <Icon
            name="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-[13.5px] text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="Search leads by name, company, or phone..."
            type="text"
          />
          {search && (
            <button
              onClick={() => onSearchChange?.('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted hover:text-on-surface"
              type="button"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* Status Filter (2 cols) */}
        <div className="lg:col-span-2 relative">
          <select
            value={status.toLowerCase()}
            onChange={(e) => onStatusChange?.(e.target.value === 'all' ? 'All' : e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-surface-elevated text-on-surface text-[14px] appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer border border-border"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Meeting Booked</option>
            <option value="unqualified">Unreachable</option>
            <option value="dnc">Do Not Call</option>
          </select>
          <Icon
            name="expand_more"
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant"
          />
        </div>

        {/* DNC Filter (2 cols) */}
        <div className="lg:col-span-2 relative">
          <select
            value={dncFilter}
            onChange={(e) => onDncFilterChange?.(e.target.value as any)}
            className="w-full px-3 py-2 rounded-md bg-surface-elevated text-on-surface text-[14px] appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer border border-border"
          >
            <option value="all">All Contacts</option>
            <option value="callable">Callable Only</option>
            <option value="dnc">DNC Excluded</option>
          </select>
          <Icon
            name="expand_more"
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant"
          />
        </div>

        {/* Actions (3 cols) */}
        <div className="lg:col-span-3 flex items-center justify-end gap-2">
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="text-[13px] text-error hover:underline font-medium px-2 py-1"
              type="button"
            >
              Clear Filters
            </button>
          )}

          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${
              showMoreFilters
                ? 'bg-surface-secondary text-on-surface border-border-strong'
                : 'bg-surface-elevated text-on-surface-variant hover:text-on-surface border-border'
            }`}
            type="button"
          >
            <Icon name="tune" size={16} />
            <span>More Filters</span>
          </button>
        </div>
      </div>

      {/* Expanded Filters Drawer */}
      {showMoreFilters && (
        <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
          <div>
            <label className="block text-on-surface-variant font-medium mb-1">Tag Filter</label>
            <select
              value={selectedTag}
              onChange={(e) => onTagChange?.(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md bg-surface-elevated border border-border text-on-surface"
            >
              <option value="All">All Tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-on-surface-variant font-medium mb-1">Lead Source</label>
            <select
              value={source}
              onChange={(e) => onSourceChange?.(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md bg-surface-elevated border border-border text-on-surface"
            >
              <option value="All">All Sources</option>
              <option value="CSV Import">CSV Import</option>
              <option value="Manual Entry">Manual Entry</option>
              <option value="API Ingestion">API Ingestion</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
