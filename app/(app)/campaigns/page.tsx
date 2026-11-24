'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/lib/ui/icons';
import { CampaignsHeader } from '@/features/campaigns/CampaignsHeader';
import { CampaignCard } from '@/features/campaigns/CampaignCard';
import { SecondaryCampaignsList } from '@/features/campaigns/SecondaryCampaignsList';
import { CadenceRulesPanel } from '@/features/campaigns/CadenceRulesPanel';
import { QuickTestSimulator } from '@/features/campaigns/QuickTestSimulator';
import { PacingOverrideModal } from '@/features/campaigns/PacingOverrideModal';
import { NewCampaignModal } from '@/features/campaigns/NewCampaignModal';
import { NewCampaignStudio } from '@/features/campaigns/NewCampaignStudio';
import { EditCampaignModal } from '@/features/campaigns/EditCampaignModal';
import { CampaignDrawer } from '@/features/campaigns/CampaignDrawer';
import type { Campaign } from '@/types';

function CampaignsContent() {
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action') || searchParams.get('view');
  const statusParam = searchParams.get('status');

  if (actionParam === 'new') {
    return <NewCampaignStudio />;
  }

  return <CampaignsMainView statusFilter={statusParam} />;
}

function CampaignsMainView({ statusFilter }: { statusFilter?: string | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isPacingModalOpen, setIsPacingModalOpen] = useState(false);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [selectedCampaignForEdit, setSelectedCampaignForEdit] = useState<Campaign | null>(null);
  const [selectedCampaignIdForDrawer, setSelectedCampaignIdForDrawer] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/campaigns?limit=50');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCampaigns(json.data);
      } else {
        setErrorMessage(json.error || 'Failed to load campaigns');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching campaigns';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleCampaignAction = async (campaignId: string, action: 'start' | 'pause' | 'resume') => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || `Failed to ${action} campaign`);
        return;
      }
      showToast(`Campaign ${action}ed successfully.`);
      await loadCampaigns();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      showToast(message);
    }
  };

  const headerMetrics = {
    running: campaigns.filter((c) => c.status === 'running' || c.status === 'live').length,
    scheduled: campaigns.filter((c) => c.status === 'scheduled').length,
    paused: campaigns.filter((c) => c.status === 'paused').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
  };

  const filteredCampaigns = statusFilter
    ? campaigns.filter((c) => {
        if (statusFilter === 'running') return c.status === 'running' || c.status === 'live';
        return c.status === statusFilter;
      })
    : campaigns;

  const featuredCampaign =
    filteredCampaigns.find((c) => c.status === 'running' || c.status === 'live') ||
    filteredCampaigns.find((c) => c.status === 'scheduled') ||
    filteredCampaigns[0] ||
    null;

  return (
    <div className="rm-page flex w-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 p-5 lg:p-6">
        {/* Header */}
        <CampaignsHeader
          metrics={headerMetrics}
          onOpenPacingModal={() => setIsPacingModalOpen(true)}
          onCreateCampaign={() => setIsNewCampaignOpen(true)}
        />

        {statusFilter && (
          <div className="p-3 bg-surface border border-border rounded-lg flex items-center justify-between text-xs">
            <span className="text-on-surface-variant font-medium">
              Filtered by Status: <strong className="text-primary uppercase font-mono">{statusFilter}</strong> ({filteredCampaigns.length} campaigns)
            </span>
            <a href="/campaigns" className="text-primary hover:underline font-semibold">
              Show All Campaigns
            </a>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg bg-error/15 border border-error/20 text-error text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={loadCampaigns}
              className="text-primary hover:underline font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-12 bg-surface rounded-xl border border-border">
            <div className="flex flex-col items-center gap-2">
              <Icon name="progress_activity" size={32} className="animate-spin text-primary" />
              <span className="text-body-sm text-on-surface-variant">Loading outbound campaigns...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
            {/* Left Column: Featured & Campaigns List */}
            <div className="lg:col-span-8 flex flex-col gap-space-lg">
              {featuredCampaign ? (
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between px-space-xs">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                      Featured Active Campaign
                    </span>
                    <span className="font-data-tabular text-body-sm text-primary font-mono font-medium">
                      Campaign Node #{featuredCampaign.id.slice(0, 8)}
                    </span>
                  </div>

                  <CampaignCard
                    campaign={featuredCampaign}
                    onStart={() => handleCampaignAction(featuredCampaign.id, 'start')}
                    onPause={() => handleCampaignAction(featuredCampaign.id, 'pause')}
                    onResume={() => handleCampaignAction(featuredCampaign.id, 'resume')}
                    onEdit={() => setSelectedCampaignForEdit(featuredCampaign)}
                    onViewDetails={() => setSelectedCampaignIdForDrawer(featuredCampaign.id)}
                  />
                </div>
              ) : null}

              {/* Secondary campaigns list */}
              <SecondaryCampaignsList
                campaigns={filteredCampaigns.filter((c) => c.id !== featuredCampaign?.id)}
                onStartCampaign={(campaign) => handleCampaignAction(campaign.id, 'start')}
                onPauseCampaign={(campaign) => handleCampaignAction(campaign.id, 'pause')}
                onResumeCampaign={(campaign) => handleCampaignAction(campaign.id, 'resume')}
                onEditCampaign={(campaign) => setSelectedCampaignForEdit(campaign)}
                onViewCampaignDetails={(campaign) => setSelectedCampaignIdForDrawer(campaign.id)}
              />
            </div>

            {/* Right Column: Spectrum & Cadence */}
            <div className="lg:col-span-4 flex flex-col gap-space-lg">
              <div className="rm-card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <Icon name="analytics" size={18} className="text-primary" />
                  <h3 className="text-[14px] font-semibold text-on-surface">Portfolio snapshot</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-surface-elevated p-3">
                    <div className="text-[11px] text-on-surface-variant">Running</div>
                    <div className="text-[18px] font-semibold tabular-nums">{headerMetrics.running}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-elevated p-3">
                    <div className="text-[11px] text-on-surface-variant">Paused</div>
                    <div className="text-[18px] font-semibold tabular-nums">{headerMetrics.paused}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-elevated p-3">
                    <div className="text-[11px] text-on-surface-variant">Scheduled</div>
                    <div className="text-[18px] font-semibold tabular-nums">{headerMetrics.scheduled}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-elevated p-3">
                    <div className="text-[11px] text-on-surface-variant">Completed</div>
                    <div className="text-[18px] font-semibold tabular-nums">{headerMetrics.completed}</div>
                  </div>
                </div>
                <div className="text-[12px] text-on-surface-variant">
                  {campaigns.reduce((sum, c) => sum + (c.leadCount || 0), 0)} enrolled leads across {campaigns.length} campaigns
                </div>
                <div className="mt-1 flex flex-col gap-2">
                  {campaigns.slice(0, 5).map((campaign) => {
                    const connected = campaign.detailedMetrics?.connected ?? campaign.stats?.connectedPickups ?? 0;
                    const maxConnected = Math.max(
                      ...campaigns.map((item) => item.detailedMetrics?.connected ?? item.stats?.connectedPickups ?? 0),
                      1
                    );
                    return (
                      <div key={campaign.id}>
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span className="truncate text-on-surface">{campaign.name}</span>
                          <span className="tabular-nums text-on-surface-variant">{connected} connected</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                          <div
                            className="h-full origin-left rounded-full bg-primary transition-[width] duration-500"
                            style={{ width: `${Math.round((connected / maxConnected) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {campaigns.length === 0 && (
                    <p className="text-[12px] text-on-surface-variant">Connected calls appear after a campaign records them.</p>
                  )}
                </div>
              </div>
              <CadenceRulesPanel />
              <QuickTestSimulator />
            </div>
          </div>
        )}

        {/* Modals & Drawers */}
        <PacingOverrideModal
          isOpen={isPacingModalOpen}
          onClose={() => setIsPacingModalOpen(false)}
          onApply={(channels) => {
            showToast(`Concurrent lines set to ${channels}`);
            setIsPacingModalOpen(false);
          }}
        />

        <NewCampaignModal
          isOpen={isNewCampaignOpen}
          onClose={() => setIsNewCampaignOpen(false)}
          onCreated={() => {
            showToast('New campaign created successfully.');
            loadCampaigns();
          }}
        />

        <EditCampaignModal
          isOpen={!!selectedCampaignForEdit}
          campaign={selectedCampaignForEdit}
          onClose={() => setSelectedCampaignForEdit(null)}
          onUpdated={() => {
            showToast('Campaign settings updated.');
            loadCampaigns();
          }}
        />

        <CampaignDrawer
          isOpen={Boolean(selectedCampaignIdForDrawer)}
          campaignId={selectedCampaignIdForDrawer}
          onClose={() => setSelectedCampaignIdForDrawer(null)}
          onActionComplete={() => loadCampaigns()}
        />

        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-surface-elevated border border-primary/30 p-3.5 text-sm text-primary font-semibold shadow-xl flex items-center gap-2 animate-in fade-in">
            <Icon name="check_circle" size={18} />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading Campaigns Studio...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
