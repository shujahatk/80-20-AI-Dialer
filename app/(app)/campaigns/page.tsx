'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/lib/ui/icons';
import { PageShell } from '@/components/ui/page-shell';
import { CampaignsHeader } from '@/features/campaigns/CampaignsHeader';
import { CampaignCard } from '@/features/campaigns/CampaignCard';
import { SecondaryCampaignsList } from '@/features/campaigns/SecondaryCampaignsList';
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
      await fetch('/api/campaigns/cron', { method: 'POST' }).catch(() => null);
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
    null;

  return (
    <PageShell wide>
      <div className="flex flex-col gap-4">
        <CampaignsHeader
          metrics={headerMetrics}
          onCreateCampaign={() => setIsNewCampaignOpen(true)}
        />

        {statusFilter && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2 text-xs">
            <span className="font-medium text-on-surface-variant">
              Filtered by status: <strong className="font-mono uppercase text-primary">{statusFilter}</strong> ({filteredCampaigns.length})
            </span>
            <a href="/campaigns" className="font-semibold text-primary hover:underline">
              Show All Campaigns
            </a>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center justify-between rounded-lg border border-error/25 bg-error-surface p-3 text-xs text-error">
            <span>{errorMessage}</span>
            <button onClick={loadCampaigns} className="font-semibold text-primary hover:underline" type="button">
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-surface p-12">
            <span className="text-[13px] text-on-surface-variant">Loading campaigns...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {featuredCampaign && (
              <CampaignCard
                campaign={featuredCampaign}
                onStart={() => handleCampaignAction(featuredCampaign.id, 'start')}
                onPause={() => handleCampaignAction(featuredCampaign.id, 'pause')}
                onResume={() => handleCampaignAction(featuredCampaign.id, 'resume')}
                onEdit={() => setSelectedCampaignForEdit(featuredCampaign)}
                onViewDetails={() => setSelectedCampaignIdForDrawer(featuredCampaign.id)}
              />
            )}

            <SecondaryCampaignsList
              campaigns={filteredCampaigns}
              onStartCampaign={(campaign) => handleCampaignAction(campaign.id, 'start')}
              onPauseCampaign={(campaign) => handleCampaignAction(campaign.id, 'pause')}
              onResumeCampaign={(campaign) => handleCampaignAction(campaign.id, 'resume')}
              onEditCampaign={(campaign) => setSelectedCampaignForEdit(campaign)}
              onViewCampaignDetails={(campaign) => setSelectedCampaignIdForDrawer(campaign.id)}
            />
          </div>
        )}

        <NewCampaignModal
          isOpen={isNewCampaignOpen}
          onClose={() => setIsNewCampaignOpen(false)}
          onCreated={() => {
            showToast('Campaign created successfully.');
            loadCampaigns();
          }}
        />

        <EditCampaignModal
          isOpen={Boolean(selectedCampaignForEdit)}
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
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-primary/30 bg-surface-elevated p-3 text-[13px] font-medium text-on-surface shadow-lg rm-fade">
            <Icon name="check_circle" size={16} className="text-primary" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading Campaigns...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
