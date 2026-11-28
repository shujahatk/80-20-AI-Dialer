'use client';

import React, { useState } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';

interface LeadsFiltersBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  status?: string;
  onStatusChange?: (val: string) => void;
  campaignFilter?: string;
  onCampaignFilterChange?: (val: string) => void;
  availableCampaigns?: Array<{ id: string; name: string }>;
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
  campaignFilter = 'All',
  onCampaignFilterChange,
  availableCampaigns = [],
  priority = 'All',
  onPriorityChange,
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
    campaignFilter !== 'All' ||
    priority !== 'All' ||
    dncFilter !== 'all' ||
    selectedTag !== 'All' ||
    source !== 'All';

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-muted" />
          <input
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-input pl-8 pr-7 text-[13px] text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none"
            placeholder="Search by name, company, email, or phone..."
            type="text"
          />
          {search && (
            <button
              onClick={() => onSearchChange?.('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-muted hover:text-on-surface"
              type="button"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Qualification / Status Filter */}
        <div className="relative min-w-[155px]">
          <select
            value={status.toLowerCase()}
            onChange={(e) => onStatusChange?.(e.target.value === 'all' ? 'All' : e.target.value)}
            aria-label="Filter by qualification status"
            className="h-8 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-secondary pl-2.5 pr-7 text-[12.5px] font-medium text-on-surface focus:border-primary focus:outline-none"
          >
            <option value="all">All Qualifications</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="needs-review">Needs Review</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Meeting Booked</option>
            <option value="unqualified">Unqualified</option>
            <option value="dnc">Do Not Call</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
        </div>

        {/* Campaign Filter */}
        <div className="relative min-w-[165px]">
          <select
            value={campaignFilter}
            onChange={(e) => onCampaignFilterChange?.(e.target.value)}
            aria-label="Filter by campaign"
            className="h-8 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-secondary pl-2.5 pr-7 text-[12.5px] font-medium text-on-surface focus:border-primary focus:outline-none"
          >
            <option value="All">All Campaigns</option>
            <option value="unassigned">Unassigned</option>
            {availableCampaigns.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {camp.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
        </div>

        {/* More Filters Dropdown Toggle */}
        <button
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors ${
            showMoreFilters
              ? 'border-primary/40 bg-sidebar-active text-primary'
              : 'border-border bg-surface-secondary text-on-surface-variant hover:text-on-surface'
          }`}
          type="button"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>More Filters</span>
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="h-8 px-2 text-[12px] font-medium text-on-surface-variant hover:text-on-surface hover:underline"
            type="button"
          >
            Reset
          </button>
        )}
      </div>

      {/* Expanded Secondary Filters */}
      {showMoreFilters && (
        <div className="grid grid-cols-1 gap-2.5 border-t border-border pt-2.5 text-[12px] sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-on-surface-variant">Calling Eligibility</label>
            <select
              value={dncFilter}
              onChange={(e) => onDncFilterChange?.(e.target.value as 'all' | 'callable' | 'dnc')}
              className="h-8 w-full rounded-md border border-border bg-surface-secondary px-2.5 text-[12px] text-on-surface"
            >
              <option value="all">All Contacts</option>
              <option value="callable">Callable Only</option>
              <option value="dnc">Do Not Call Only</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-on-surface-variant">Priority</label>
            <select
              value={priority}
              onChange={(e) => onPriorityChange?.(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface-secondary px-2.5 text-[12px] text-on-surface"
            >
              <option value="All">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-on-surface-variant">Tag</label>
            <select
              value={selectedTag}
              onChange={(e) => onTagChange?.(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface-secondary px-2.5 text-[12px] text-on-surface"
            >
              <option value="All">All Tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-on-surface-variant">Source</label>
            <select
              value={source}
              onChange={(e) => onSourceChange?.(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface-secondary px-2.5 text-[12px] text-on-surface"
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
