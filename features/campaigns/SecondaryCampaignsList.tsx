'use client';

import React, { useState, useMemo } from 'react';
import type { Campaign, CampaignStatus } from '@/types';

interface SecondaryCampaignsListProps {
  campaigns: Campaign[];
  onStartCampaign?: (campaign: Campaign) => void;
  onPauseCampaign?: (campaign: Campaign) => void;
  onResumeCampaign?: (campaign: Campaign) => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onViewCampaignDetails?: (campaign: Campaign) => void;
}

export const SecondaryCampaignsList: React.FC<SecondaryCampaignsListProps> = ({
  campaigns,
  onStartCampaign,
  onPauseCampaign,
  onResumeCampaign,
  onEditCampaign,
  onViewCampaignDetails,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'running' | 'scheduled' | 'paused' | 'completed' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'progress' | 'leads'>('created');

  const counts = useMemo(() => {
    return {
      all: campaigns.length,
      running: campaigns.filter((c) => c.status === 'running' || c.status === 'live').length,
      scheduled: campaigns.filter((c) => c.status === 'scheduled').length,
      paused: campaigns.filter((c) => c.status === 'paused').length,
      completed: campaigns.filter((c) => c.status === 'completed').length,
      draft: campaigns.filter((c) => c.status === 'draft').length,
    };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    if (activeFilter !== 'all') {
      if (activeFilter === 'running') {
        result = result.filter((c) => c.status === 'running' || c.status === 'live');
      } else {
        result = result.filter((c) => c.status === activeFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'progress') return b.progressPercent - a.progressPercent;
      if (sortBy === 'leads') return b.leadCount - a.leadCount;
      return 0;
    });

    return result;
  }, [campaigns, activeFilter, searchQuery, sortBy]);

  const getStatusBadge = (status: CampaignStatus) => {
    if (status === 'running' || status === 'live') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold bg-success-surface text-success border border-success/20">
          Running
        </span>
      );
    }
    if (status === 'paused') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold bg-warning-surface text-warning border border-warning/20">
          Paused
        </span>
      );
    }
    if (status === 'scheduled') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold bg-info-surface text-info border border-info/20">
          Scheduled
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold bg-surface-secondary text-on-surface border border-border">
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold bg-surface-secondary text-on-surface-variant border border-border">
        Draft
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'running', 'scheduled', 'paused', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors capitalize ${
                activeFilter === tab
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated'
              }`}
            >
              {tab} ({counts[tab] ?? 0})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="px-3 py-1.5 rounded-md bg-surface-elevated text-[13px] border border-border text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-left text-[14px] min-w-[800px]">
          <thead>
            <tr className="bg-surface-elevated text-on-surface-variant text-[13px] uppercase tracking-wider border-b border-border font-semibold">
              <th className="py-3.5 px-4">Campaign</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Progress</th>
              <th className="py-3.5 px-4">Leads</th>
              <th className="py-3.5 px-4">Agent</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-on-surface-variant text-[14px]">
                  No campaigns match the selected filter.
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-surface-elevated transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface">
                    {camp.name}
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(camp.status)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 w-32">
                      <div className="flex-1 h-2 rounded-full bg-surface-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, camp.progressPercent)}%` }}
                        />
                      </div>
                      <span className="text-[12px] text-on-surface-variant font-medium">
                        {camp.progressPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-on-surface">
                    {camp.completedLeads} / {camp.leadCount}
                  </td>
                  <td className="py-3.5 px-4 text-on-surface-variant">
                    {camp.agentName}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      {camp.status === 'running' && (
                        <button
                          onClick={() => onPauseCampaign?.(camp)}
                          className="px-2.5 py-1 rounded text-[12px] font-semibold bg-surface-elevated hover:bg-surface-secondary text-on-surface border border-border"
                        >
                          Pause
                        </button>
                      )}
                      {camp.status === 'paused' && (
                        <button
                          onClick={() => onResumeCampaign?.(camp)}
                          className="px-2.5 py-1 rounded text-[12px] font-semibold bg-primary hover:bg-primary-hover text-on-primary"
                        >
                          Resume
                        </button>
                      )}
                      {(camp.status === 'draft' || camp.status === 'scheduled') && (
                        <button
                          onClick={() => onStartCampaign?.(camp)}
                          className="px-2.5 py-1 rounded text-[12px] font-semibold bg-primary hover:bg-primary-hover text-on-primary"
                        >
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => onViewCampaignDetails?.(camp)}
                        className="px-2.5 py-1 rounded text-[12px] font-semibold bg-surface-elevated hover:bg-surface-secondary text-on-surface border border-border"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
