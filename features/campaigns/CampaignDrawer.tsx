'use client';

import React, { useState, useEffect } from 'react';
import type { Campaign } from '@/types';
import type { CampaignLeadMembership } from '@/repositories/campaigns.repository';
import { Icon } from '@/lib/ui/icons';

interface CampaignDrawerProps {
  isOpen: boolean;
  campaignId: string | null;
  onClose: () => void;
  onActionComplete?: () => void;
}

export const CampaignDrawer: React.FC<CampaignDrawerProps> = ({
  isOpen,
  campaignId,
  onClose,
  onActionComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'calls' | 'performance' | 'configuration'>('overview');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<CampaignLeadMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemovingLead, setIsRemovingLead] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchCampaignData = async () => {
    if (!campaignId) return;
    setIsLoading(true);
    try {
      const [campRes, leadsRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/leads?limit=100`),
      ]);

      const campData = await campRes.json();
      if (campData.success && campData.data) {
        setCampaign(campData.data);
      }

      const leadsData = await leadsRes.json();
      if (leadsData.success && Array.isArray(leadsData.data)) {
        setLeads(leadsData.data);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && campaignId) {
      setActiveTab('overview');
      setStatusMessage(null);
      fetchCampaignData();
    } else {
      setCampaign(null);
      setLeads([]);
    }
  }, [isOpen, campaignId]);

  if (!isOpen || !campaignId) return null;

  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'complete' | 'cancel') => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || `Failed to ${action} campaign`);
      }
      setStatusMessage(`Campaign successfully transitioned to ${action}ed`);
      await fetchCampaignData();
      onActionComplete?.();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLead = async (leadId: string) => {
    if (!confirm('Remove this lead from the campaign?')) return;
    setIsRemovingLead(leadId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/leads?leadId=${leadId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove lead');
      }
      setLeads((prev) => prev.filter((l) => l.leadId !== leadId));
      await fetchCampaignData();
      onActionComplete?.();
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to remove lead');
    } finally {
      setIsRemovingLead(null);
    }
  };

  const isRunning = campaign?.status === 'running' || campaign?.status === 'live';
  const isPaused = campaign?.status === 'paused';
  const isDraft = campaign?.status === 'draft';
  const isScheduled = campaign?.status === 'scheduled';
  const isTerminal = campaign?.status === 'completed' || campaign?.status === 'cancelled';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-surface-container-lowest/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface-container-low h-full shadow-2xl border-l border-outline-variant/20 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              <Icon name="campaign" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface">
                  {campaign?.name || 'Campaign Details'}
                </h2>
                {campaign && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 capitalize text-on-surface">
                    {campaign.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">
                ID: {campaignId} • {leads.length} enrolled leads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Quick Action Ribbon */}
        <div className="px-4 py-2 bg-surface-container border-b border-outline-variant/10 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            {(isDraft || isScheduled) && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('start')}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-tertiary-container text-on-tertiary-container font-semibold hover:bg-tertiary hover:text-surface transition-all"
              >
                <Icon name="play_arrow" size={14} />
                <span>Start Campaign</span>
              </button>
            )}

            {isRunning && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('pause')}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-semibold transition-all border border-outline-variant/20"
              >
                <Icon name="pause" size={14} />
                <span>Pause</span>
              </button>
            )}

            {isPaused && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('resume')}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-on-primary font-semibold transition-all shadow-sm"
              >
                <Icon name="play_arrow" size={14} />
                <span>Resume</span>
              </button>
            )}

            {!isTerminal && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('complete')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface font-medium transition-all"
              >
                <Icon name="check_circle" size={14} />
                <span>Complete</span>
              </button>
            )}

            {!isTerminal && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('cancel')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-error hover:bg-error-container/20 font-medium transition-all"
              >
                <Icon name="cancel" size={14} />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {statusMessage && (
            <span className="text-[0.6875rem] text-primary font-medium animate-in fade-in">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-4 border-b border-outline-variant/10 text-xs font-semibold bg-surface-container-low">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'leads'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Leads ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'calls'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Calls
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'performance'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setActiveTab('configuration')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'configuration'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Configuration
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {isLoading && !campaign ? (
            <div className="p-8 text-center text-on-surface-variant">Loading campaign details...</div>
          ) : (
            <>
              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-4">
                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/10 flex flex-col gap-2">
                    <span className="font-semibold text-on-surface text-sm">Campaign Overview</span>
                    <p className="text-on-surface-variant">
                      {campaign?.description || 'No description provided.'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-outline-variant/10 text-[0.6875rem]">
                      <div>
                        <span className="text-on-surface-variant block">Status</span>
                        <span className="font-semibold text-on-surface capitalize">{campaign?.status}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Assigned Agent</span>
                        <span className="font-semibold text-on-surface">{campaign?.agentName}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Calling Window</span>
                        <span className="font-semibold text-on-surface">{campaign?.scheduleWindow}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Max Line Concurrency</span>
                        <span className="font-semibold text-on-surface">{campaign?.concurrentLines} lines</span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-on-surface-variant block">Enrolled Leads</span>
                      <span className="text-lg font-bold text-on-surface">{campaign?.leadCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-on-surface-variant block">Attempted</span>
                      <span className="text-lg font-bold text-on-surface">{campaign?.completedLeads}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-tertiary block">Connected</span>
                      <span className="text-lg font-bold text-tertiary">
                        {campaign?.stats?.connectedPickups ?? 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-primary block">Appointments</span>
                      <span className="text-lg font-bold text-primary">
                        {campaign?.stats?.bookedAppointments ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-on-surface">Queue Progress</span>
                      <span className="text-primary font-bold">{campaign?.progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${campaign?.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Leads Table */}
              {activeTab === 'leads' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface">
                      Enrolled Leads ({leads.length})
                    </span>
                    <span className="text-[0.6875rem] text-on-surface-variant">
                      Leads can be removed before terminal outcome
                    </span>
                  </div>

                  <div className="rounded-xl border border-outline-variant/10 overflow-hidden bg-surface-container-low">
                    {leads.length === 0 ? (
                      <div className="p-6 text-center text-on-surface-variant">
                        No leads enrolled in this campaign yet.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-surface-container border-b border-outline-variant/10 sticky top-0">
                          <tr>
                            <th className="p-2.5 font-semibold text-on-surface">Lead</th>
                            <th className="p-2.5 font-semibold text-on-surface">Company</th>
                            <th className="p-2.5 font-semibold text-on-surface">Attempts</th>
                            <th className="p-2.5 font-semibold text-on-surface">Status</th>
                            <th className="p-2.5 font-semibold text-on-surface">Outcome</th>
                            <th className="p-2.5 font-semibold text-on-surface text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {leads.map((m) => {
                            const isFinal = m.state === 'completed' || m.state === 'abandoned';
                            return (
                              <tr key={m.id} className="hover:bg-surface-container/60 transition-colors">
                                <td className="p-2.5 font-medium text-on-surface">
                                  <div>{m.lead.fullName}</div>
                                  <div className="text-[0.6875rem] text-on-surface-variant font-mono">
                                    {m.lead.phone}
                                  </div>
                                </td>
                                <td className="p-2.5 text-on-surface-variant">{m.lead.companyName}</td>
                                <td className="p-2.5 text-on-surface font-semibold">{m.attemptCount}</td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[0.625rem] font-semibold capitalize ${
                                      m.state === 'calling'
                                        ? 'bg-tertiary-container/30 text-tertiary animate-pulse'
                                        : m.state === 'completed'
                                        ? 'bg-surface-container text-on-surface'
                                        : m.state === 'abandoned'
                                        ? 'bg-error-container/30 text-error'
                                        : 'bg-surface-container text-on-surface-variant'
                                    }`}
                                  >
                                    {m.state}
                                  </span>
                                </td>
                                <td className="p-2.5 text-on-surface-variant capitalize">
                                  {m.outcome || '—'}
                                </td>
                                <td className="p-2.5 text-right">
                                  {!isFinal ? (
                                    <button
                                      type="button"
                                      disabled={isRemovingLead === m.leadId}
                                      onClick={() => handleRemoveLead(m.leadId)}
                                      className="px-2 py-1 rounded text-error hover:bg-error-container/20 transition-colors font-medium text-[0.6875rem]"
                                      title="Remove from campaign"
                                    >
                                      {isRemovingLead === m.leadId ? '...' : 'Remove'}
                                    </button>
                                  ) : (
                                    <span className="text-[0.625rem] text-on-surface-variant">Finalized</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'calls' && (
                <div className="flex flex-col gap-3">
                  <span className="font-semibold text-on-surface">Call activity from enrolled leads</span>
                  <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low">
                    {leads.filter((m) => m.attemptCount > 0 || m.outcome).length === 0 ? (
                      <div className="p-6 text-center text-on-surface-variant">
                        No call attempts recorded for this campaign yet.
                      </div>
                    ) : (
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="sticky top-0 border-b border-outline-variant/10 bg-surface-container">
                          <tr>
                            <th className="p-2.5 font-semibold text-on-surface">Lead</th>
                            <th className="p-2.5 font-semibold text-on-surface">Attempts</th>
                            <th className="p-2.5 font-semibold text-on-surface">State</th>
                            <th className="p-2.5 font-semibold text-on-surface">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {leads
                            .filter((m) => m.attemptCount > 0 || m.outcome)
                            .map((m) => (
                              <tr key={m.id}>
                                <td className="p-2.5 font-medium text-on-surface">{m.lead.fullName}</td>
                                <td className="p-2.5 tabular-nums text-on-surface">{m.attemptCount}</td>
                                <td className="p-2.5 capitalize text-on-surface-variant">{m.state}</td>
                                <td className="p-2.5 capitalize text-on-surface-variant">{m.outcome || '—'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Performance */}
              {activeTab === 'performance' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-on-surface-variant block">Total Enrolled</span>
                      <span className="text-xl font-bold text-on-surface">{campaign?.leadCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-on-surface-variant block">Attempted Leads</span>
                      <span className="text-xl font-bold text-on-surface">{campaign?.completedLeads}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-on-surface-variant block">Remaining in Queue</span>
                      <span className="text-xl font-bold text-on-surface">
                        {(campaign?.leadCount || 0) - (campaign?.completedLeads || 0)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-tertiary block">Connected Pickups</span>
                      <span className="text-xl font-bold text-tertiary">
                        {campaign?.stats?.connectedPickups ?? 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-primary block">AI Qualified</span>
                      <span className="text-xl font-bold text-primary">
                        {campaign?.stats?.aiQualified ?? 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/10">
                      <span className="text-[0.6875rem] text-tertiary block">Appointments Booked</span>
                      <span className="text-xl font-bold text-tertiary">
                        {campaign?.stats?.bookedAppointments ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Configuration */}
              {activeTab === 'configuration' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/10 flex flex-col gap-2">
                    <span className="font-semibold text-on-surface">Calling Window &amp; Timezone Safety</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">Calling Hours</span>
                        <span className="font-semibold text-on-surface">
                          {campaign?.callingWindowStart || '09:00'} — {campaign?.callingWindowEnd || '17:00'}
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">Campaign Timezone</span>
                        <span className="font-semibold text-on-surface">{campaign?.timezone || 'America/New_York'}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">Recipient Timezone Policy</span>
                        <span className="font-semibold text-tertiary">Local Recipient Priority Enforced</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">Allowed Days</span>
                        <span className="font-semibold text-on-surface">
                          {campaign?.callingDays?.length ? 'Mon – Fri' : 'Configured Days'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/10 flex flex-col gap-2">
                    <span className="font-semibold text-on-surface">Retry &amp; Outcome Rules</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">Max Attempts per Lead</span>
                        <span className="font-semibold text-on-surface">{campaign?.maxAttempts || 4} attempts</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">Retry Delay Interval</span>
                        <span className="font-semibold text-on-surface">{campaign?.retryDelayMinutes || 60} minutes</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">DNC Protection</span>
                        <span className="font-semibold text-tertiary">Active (Enqueued &amp; Dynamic Check)</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[0.6875rem]">Concurrent Lines</span>
                        <span className="font-semibold text-on-surface">{campaign?.concurrentLines || 10} concurrent</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/10 flex flex-col gap-2">
                    <span className="font-semibold text-on-surface">Assigned AI agent</span>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                        <Icon name="smart_toy" size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-on-surface">{campaign?.agentName || 'Unassigned'}</h3>
                        <p className="text-xs text-on-surface-variant">
                          {campaign?.voiceModel ? `Voice: ${campaign.voiceModel}` : 'No voice model recorded'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
