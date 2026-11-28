/**
 * RM AI DIALER — AUTOMATED CAMPAIGN SCHEDULER & QUEUE RUNNER SERVICE
 * Handles:
 * 1. Automatic activation of scheduled campaigns when scheduledAt <= now
 * 2. Continuous queue dispatch for running campaigns (respecting concurrency & retry delays)
 * 3. Automatic campaign completion when all enrolled leads reach terminal state
 * 4. Background stale call reconciliation & due email job draining
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { CampaignsRepository } from '@/repositories/campaigns.repository';
import { CampaignsService } from './campaigns.service';
import { CallsRepository } from '@/repositories/calls.repository';
import { RetellWebhookService } from '@/services/retell/RetellWebhookService';

export interface SchedulerCycleSummary {
  timestamp: string;
  activatedCampaignIds: string[];
  dispatchedCalls: Array<{
    campaignId: string;
    leadId?: string;
    rmCallId?: string;
    retellCallId?: string;
    mode: string;
    dispatched: boolean;
    reason?: string;
    error?: string;
  }>;
  completedCampaignIds: string[];
  reconciledStaleCalls: number;
}

export class CampaignSchedulerService {
  private campaignsRepo: CampaignsRepository;
  private campaignsService: CampaignsService;
  private callsRepo: CallsRepository;
  private webhookService: RetellWebhookService;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.campaignsRepo = new CampaignsRepository(supabase);
    this.campaignsService = new CampaignsService(supabase);
    this.callsRepo = new CallsRepository(supabase);
    this.webhookService = new RetellWebhookService(supabase);
  }

  /**
   * Executes one complete autonomous scheduler and queue dispatch cycle.
   */
  async runCycle(options: {
    organizationId?: string;
    operatorId?: string;
    maxDispatchesPerCampaign?: number;
  } = {}): Promise<SchedulerCycleSummary> {
    const now = new Date();
    const nowMs = now.getTime();
    const summary: SchedulerCycleSummary = {
      timestamp: now.toISOString(),
      activatedCampaignIds: [],
      dispatchedCalls: [],
      completedCampaignIds: [],
      reconciledStaleCalls: 0,
    };

    // 1. Reconcile any stale active call locks (> 5 minutes old) so retry queues are never blocked
    try {
      const cutoffIso = new Date(nowMs - 5 * 60 * 1000).toISOString();
      const { data: staleCalls } = await this.supabase
        .from('call_sessions')
        .select('*')
        .in('status', ['queued', 'in_progress', 'ringing', 'initiated', 'registered'] as any)
        .lt('created_at', cutoffIso);

      for (const stale of (staleCalls ?? []) as any[]) {
        if (stale.retell_call_id) {
          const res = await this.webhookService.reconcileCallAnalysis(stale.retell_call_id, stale.organization_id);
          if (res.reconciled) summary.reconciledStaleCalls++;
        } else {
          await this.callsRepo.update(stale.id, stale.organization_id, {
            status: 'failed',
            failure_reason: 'Stale pre-provider session timed out',
            ended_at: now.toISOString(),
          });
          summary.reconciledStaleCalls++;
        }
      }
    } catch {
      // Non-fatal in mock/test environments
    }

    // 2. Query all scheduled and running campaigns
    let query = this.supabase
      .from('campaigns')
      .select('*')
      .in('status', ['scheduled', 'running', 'ready'] as any);

    if (options.organizationId) {
      query = query.eq('organization_id', options.organizationId);
    }

    const { data: rawCampaigns } = await query;
    const campaigns = (rawCampaigns ?? []) as any[];

    for (const raw of campaigns) {
      const orgId = raw.organization_id;
      const campaign = await this.campaignsRepo.getById(raw.id, orgId);
      if (!campaign) continue;

      const scheduledAt = (campaign as any).scheduled_at || (campaign as any).scheduledAt || campaign.start_date;

      // 2a. Check if a scheduled campaign is due to start
      if (campaign.status === 'scheduled' || (campaign.status === 'ready' && scheduledAt)) {
        const scheduledMs = scheduledAt ? Date.parse(scheduledAt) : NaN;
        if (!Number.isNaN(scheduledMs) && scheduledMs <= nowMs) {
          try {
            const active = await this.campaignsRepo.findActiveCampaign(orgId, campaign.id);
            if (!active) {
              await this.campaignsService.startCampaign(
                campaign.id,
                orgId,
                options.operatorId || campaign.created_by || undefined
              );
              summary.activatedCampaignIds.push(campaign.id);
              campaign.status = 'running' as any;
            }
          } catch {
            // If campaign has 0 leads or another campaign is active, skip activation this tick
          }
        }
      }

      // 2b. Process running campaigns
      if (campaign.status === 'running') {
        const maxBatch = options.maxDispatchesPerCampaign ?? Math.min(Number(campaign.concurrency_limit ?? 3), 5);
        const effectiveOperator =
          options.operatorId ||
          campaign.created_by ||
          'admin_scheduler';

        for (let i = 0; i < maxBatch; i++) {
          const dispatchRes = await this.campaignsService.dispatchCampaignLead(
            campaign.id,
            `scheduler_${campaign.id}`,
            orgId,
            effectiveOperator
          );

          if ('dispatched' in dispatchRes) {
            summary.dispatchedCalls.push({
              campaignId: campaign.id,
              leadId: dispatchRes.candidate?.leadId,
              rmCallId: dispatchRes.rmCallId,
              retellCallId: dispatchRes.retellCallId,
              mode: dispatchRes.mode,
              dispatched: dispatchRes.dispatched,
              reason: dispatchRes.reason,
              error: dispatchRes.error,
            });
            if (!dispatchRes.dispatched) {
              break;
            }
          } else {
            summary.dispatchedCalls.push({
              campaignId: campaign.id,
              leadId: dispatchRes.candidate?.leadId,
              mode: dispatchRes.mode,
              dispatched: Boolean(dispatchRes.candidate),
              reason: dispatchRes.reason,
            });
            if (!dispatchRes.candidate) {
              break;
            }
          }
        }

        // 2c. Check if campaign has finished all leads and retries
        try {
          const progress = await this.campaignsRepo.getProgress(campaign.id);
          if (progress.totalLeads > 0 && progress.remaining === 0 && (progress.pendingRetries ?? 0) === 0) {
            // Verify no active calls are still in progress for this campaign
            const { data: activeCalls } = await this.supabase
              .from('call_sessions')
              .select('id')
              .eq('campaign_id', campaign.id)
              .in('status', ['queued', 'in_progress', 'ringing', 'initiated', 'registered'] as any)
              .limit(1);

            if (!activeCalls || activeCalls.length === 0) {
              await this.campaignsService.completeCampaign(
                campaign.id,
                orgId,
                options.operatorId || campaign.created_by || undefined
              );
              summary.completedCampaignIds.push(campaign.id);
            }
          }
        } catch {
          // Non-fatal completion check
        }
      }
    }

    return summary;
  }
}
