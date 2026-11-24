import {
  CampaignsRepository,
  type CampaignRow,
  type CampaignInsert,
  type CampaignUpdate,
  type CampaignProgressMetrics,
  type CampaignLeadMembership,
  type ClaimedLeadCandidate,
} from '@/repositories/campaigns.repository';
import { LeadsRepository } from '@/repositories/leads.repository';
import { AgentsRepository } from '@/repositories/agents.repository';
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  type CampaignCreateInput,
  type CampaignUpdateInput,
  type CampaignStatusType,
} from '@/lib/validation';
import { isWithinCallingWindow } from '@/lib/telephony/schedule';
import { getClientEnv, getServerEnv, isMockDevMode } from '@/lib/env';
import { getDevStore } from '@/lib/dev/dev-store';
import { CampaignRetellDispatcher, type CampaignDispatchResult } from './campaign-retell-dispatcher.service';
import type { Campaign, CampaignStatus } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';

export interface CampaignEnrollmentResult {
  added: number;
  skipped: number;
  dncProtected: number;
  invalid: number;
  alreadyAdded: number;
  skippedCapacity: number;
  totalProcessed: number;
}

export interface HydratedCampaignDetails extends Campaign {
  callingDays: number[];
  callingWindowStart: string;
  callingWindowEnd: string;
  maxAttemptsPerLead: number;
  retryDelayMinutes: number;
  concurrencyLimit: number;
  dailyAttemptLimit: number;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  metrics: CampaignProgressMetrics;
}

/**
 * Authoritative Campaign State Machine Transitions.
 */
const VALID_TRANSITIONS: Record<CampaignStatusType, CampaignStatusType[]> = {
  draft: ['ready', 'running', 'scheduled', 'paused', 'archived', 'cancelled'],
  ready: ['running', 'paused', 'archived', 'completed', 'cancelled'],
  scheduled: ['ready', 'running', 'cancelled', 'archived'],
  running: ['ready', 'paused', 'completed', 'cancelled', 'archived'],
  paused: ['ready', 'running', 'completed', 'cancelled', 'archived'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: ['ready', 'draft'],
};

function toDbCampaignStatus(status: CampaignStatusType): string {
  if (status === 'running' || status === 'scheduled') return 'ready';
  if (status === 'completed' || status === 'cancelled') return 'archived';
  return status;
}

export class CampaignsService {
  private repo: CampaignsRepository;
  private leadsRepo: LeadsRepository;
  private agentsRepo: AgentsRepository;
  private retellDispatcher: CampaignRetellDispatcher;
  private defaultOrgId: string;
  private isMockDevMode: boolean;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repo = new CampaignsRepository(supabase);
    this.leadsRepo = new LeadsRepository(supabase);
    this.agentsRepo = new AgentsRepository(supabase);
    this.retellDispatcher = new CampaignRetellDispatcher(supabase);
    const env = getClientEnv();
    this.defaultOrgId = env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    this.isMockDevMode = isMockDevMode();
  }

  private toDomain(row: CampaignRow, progress?: CampaignProgressMetrics): Campaign {
    const metrics = progress || {
      totalLeads: 0,
      attempted: 0,
      remaining: 0,
      connected: 0,
      qualified: 0,
      appointments: 0,
      callbacks: 0,
      dnc: 0,
      failed: 0,
      completed: 0,
      progressPercent: 0,
    };

    const pickupRate = metrics.attempted > 0 ? (metrics.connected / metrics.attempted) * 100 : 0;
    const qualifiedRate = metrics.connected > 0 ? (metrics.qualified / metrics.connected) * 100 : 0;
    const conversionRate = metrics.connected > 0 ? (metrics.appointments / metrics.connected) * 100 : 0;

    let winStart = row.calling_window_start ?? '09:00';
    let winEnd = row.calling_window_end ?? '17:00';
    let tz = row.timezone ?? 'UTC';
    let days = row.calling_days ?? [1, 2, 3, 4, 5];
    if (row.schedule_window) {
      try {
        const parsed = JSON.parse(row.schedule_window);
        if (parsed.start) winStart = parsed.start;
        if (parsed.end) winEnd = parsed.end;
        if (parsed.timezone) tz = parsed.timezone;
        if (parsed.days) days = parsed.days;
      } catch {
        // Plain string
      }
    }

    let maxAttempts = row.max_attempts_per_lead ?? 3;
    let retryDelay = row.retry_delay_minutes ?? 60;
    let concurrency = row.concurrency_limit ?? 10;
    if (row.retry_policy) {
      try {
        const parsed = JSON.parse(row.retry_policy);
        if (parsed.maxAttempts) maxAttempts = parsed.maxAttempts;
        if (parsed.retryDelayMinutes) retryDelay = parsed.retryDelayMinutes;
        if (parsed.concurrencyLimit) concurrency = parsed.concurrencyLimit;
      } catch {
        // Plain string
      }
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      status: row.status as CampaignStatus,
      leadCount: metrics.totalLeads,
      completedLeads: metrics.completed,
      progressPercent: metrics.progressPercent,
      agentId: row.agent_id ?? row.ai_agent_id ?? 'ag_rachel',
      agentName: 'Astra (Autonomous Telephony Voice)',
      voiceModel: 'RM Voice Engine v2',
      concurrentLines: concurrency,
      maxConcurrentLines: concurrency * 2,
      pacingMultiplier: 1.5,
      scheduleWindow: `${winStart} - ${winEnd} ${tz.split('/')[1]?.replace(/_/g, ' ') ?? tz}`,
      retryRule: `${retryDelay}m retry delay, max ${maxAttempts} attempts`,
      stats: {
        connectedPickups: metrics.connected,
        pickupRate: Math.round(pickupRate * 10) / 10,
        aiQualified: metrics.qualified,
        qualifiedRate: Math.round(qualifiedRate * 10) / 10,
        bookedAppointments: metrics.appointments,
        conversionRate: Math.round(conversionRate * 10) / 10,
      },
      callingDays: days,
      callingWindowStart: winStart,
      callingWindowEnd: winEnd,
      timezone: tz,
      maxAttempts,
      retryDelayMinutes: retryDelay,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      detailedMetrics: metrics,
    };
  }

  // =========================================================================
  // CAMPAIGN CRUD & QUERIES
  // =========================================================================

  async getCampaigns(
    organizationId?: string,
    options: { status?: string; search?: string; limit?: number; offset?: number } = {}
  ): Promise<{ campaigns: Campaign[]; totalCount: number }> {
    const orgId = organizationId ?? this.defaultOrgId;
    const { campaigns: rows, totalCount } = await this.repo.list(orgId, options);

    const domains = await Promise.all(
      rows.map(async (row) => {
        const progress = await this.repo.getProgress(row.id);
        return this.toDomain(row, progress);
      })
    );

    return { campaigns: domains, totalCount };
  }

  async getCampaignById(id: string, organizationId?: string): Promise<HydratedCampaignDetails | null> {
    const orgId = organizationId ?? this.defaultOrgId;
    const row = await this.repo.getById(id, orgId);
    if (!row) return null;

    const progress = await this.repo.getProgress(id);
    const domain = this.toDomain(row, progress);

    return {
      ...domain,
      callingDays: row.calling_days || [1, 2, 3, 4, 5],
      callingWindowStart: row.calling_window_start,
      callingWindowEnd: row.calling_window_end,
      maxAttemptsPerLead: row.max_attempts_per_lead,
      retryDelayMinutes: row.retry_delay_minutes,
      concurrencyLimit: row.concurrency_limit,
      dailyAttemptLimit: row.daily_attempt_limit,
      startDate: row.start_date,
      endDate: row.end_date,
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      metrics: progress,
    };
  }

  /**
   * Asserts that an AI Agent is published and eligible for assignment to campaigns (STEP 29)
   */
  async assertAgentEligibleForCampaign(agentId: string, organizationId?: string): Promise<void> {
    const orgId = organizationId ?? this.defaultOrgId;
    const agent = await this.agentsRepo.getById(agentId, orgId);
    if (!agent) {
      throw new Error(`AI Agent '${agentId}' not found.`);
    }

    if (agent.stage_state !== 'published') {
      throw new Error(
        `Cannot assign AI Agent "${agent.name}": Only published agents can be assigned to campaigns (Current status: ${agent.stage_state}). Please complete training, simulations, and publishing in Agent Studio first.`
      );
    }
  }

  async createCampaign(input: CampaignCreateInput, organizationId?: string, actorId?: string): Promise<Campaign> {
    const validated = campaignCreateSchema.parse(input);
    const orgId = organizationId ?? this.defaultOrgId;

    if (validated.aiAgentId) {
      await this.assertAgentEligibleForCampaign(validated.aiAgentId, orgId);
    }

    if (validated.status === 'running') {
      const activeCampaign = await this.repo.findActiveCampaign(orgId);
      if (activeCampaign) {
        throw new Error(
          `Cannot create active campaign "${validated.name}": Another campaign ("${activeCampaign.name}", ID: ${activeCampaign.id}) is already active. Only one active campaign is permitted at a time.`
        );
      }
    }

    const campaignInsert: CampaignInsert = {
      organization_id: orgId,
      name: validated.name,
      description: validated.description,
      status: validated.status,
      ai_agent_id: validated.aiAgentId || null,
      timezone: validated.timezone,
      calling_days: validated.callingDays,
      start_date: validated.startDate || null,
      end_date: validated.endDate || null,
      calling_window_start: validated.callingWindowStart,
      calling_window_end: validated.callingWindowEnd,
      max_attempts_per_lead: validated.maxAttemptsPerLead,
      retry_delay_minutes: validated.retryDelayMinutes,
      concurrency_limit: validated.concurrencyLimit,
      daily_attempt_limit: validated.dailyAttemptLimit,
      created_by: actorId || null,
    };

    const row = await this.repo.create(campaignInsert);

    await this.logEvent(row.id, orgId, 'campaign.created', { name: row.name }, actorId);
    await this.logAudit(orgId, actorId, 'campaign.created', 'campaign', row.id, { name: row.name });

    return this.toDomain(row);
  }

  async updateCampaign(
    id: string,
    input: CampaignUpdateInput,
    organizationId?: string,
    actorId?: string
  ): Promise<Campaign> {
    const validated = campaignUpdateSchema.parse(input);
    const orgId = organizationId ?? this.defaultOrgId;

    const existing = await this.repo.getById(id, orgId);
    if (!existing) throw new Error('Campaign not found');

    if (validated.aiAgentId && validated.aiAgentId !== existing.ai_agent_id) {
      await this.assertAgentEligibleForCampaign(validated.aiAgentId, orgId);
    }

    // State machine editing constraints (STEP 5)
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error(`Cannot modify campaign in terminal status "${existing.status}".`);
    }

    if (existing.status === 'running') {
      // Disallow changing structural rules while campaign is actively dialing
      if (
        validated.maxAttemptsPerLead !== undefined &&
        validated.maxAttemptsPerLead !== existing.max_attempts_per_lead
      ) {
        throw new Error('Cannot change maximum attempts while campaign is running. Pause campaign first.');
      }
      if (validated.aiAgentId !== undefined && validated.aiAgentId !== existing.ai_agent_id) {
        throw new Error('Cannot switch AI agent while campaign is running. Pause campaign first.');
      }
    }

    const row = await this.repo.update(id, orgId, validated as CampaignUpdate);

    await this.logEvent(id, orgId, 'campaign.updated', { changedFields: Object.keys(validated) }, actorId);
    await this.logAudit(orgId, actorId, 'campaign.updated', 'campaign', id, { changedFields: Object.keys(validated) });

    const progress = await this.repo.getProgress(id);
    return this.toDomain(row, progress);
  }

  // =========================================================================
  // STATE MACHINE TRANSITIONS (STEP 8, 9, 10)
  // =========================================================================

  async transitionState(
    id: string,
    targetStatus: CampaignStatusType,
    organizationId?: string,
    actorId?: string
  ): Promise<Campaign> {
    const orgId = organizationId ?? this.defaultOrgId;
    const campaign = await this.repo.getById(id, orgId);
    if (!campaign) throw new Error('Campaign not found');

    const currentStatus = campaign.status as CampaignStatusType;

    // Check valid transitions
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Invalid state transition: Cannot change campaign from "${currentStatus}" to "${targetStatus}". Permitted transitions: [${allowed.join(', ')}]`
      );
    }

    const timestamps: { started_at?: string; completed_at?: string } = {};

    // Starting requirements (STEP 9)
    if (targetStatus === 'running' || targetStatus === 'scheduled') {
      if (campaign.ai_agent_id) {
        await this.assertAgentEligibleForCampaign(campaign.ai_agent_id, orgId);
      }
    }

    if (targetStatus === 'running') {
      const activeCampaign = await this.repo.findActiveCampaign(orgId, id);
      if (activeCampaign) {
        throw new Error(
          `Cannot start campaign "${campaign.name}": Another campaign ("${activeCampaign.name}", ID: ${activeCampaign.id}) is already active. Only one active campaign is permitted at a time.`
        );
      }
      const progress = await this.repo.getProgress(id);
      if (progress.totalLeads === 0) {
        throw new Error('Cannot start campaign: No leads have been enrolled. Please assign leads first.');
      }
      if (progress.remaining === 0) {
        throw new Error('Cannot start campaign: All enrolled leads have already completed dialing attempts.');
      }
      if (!campaign.started_at) {
        timestamps.started_at = new Date().toISOString();
      }
    }

    if (targetStatus === 'completed') {
      timestamps.completed_at = new Date().toISOString();
    }

    const dbStatus = toDbCampaignStatus(targetStatus);
    const updated = await this.repo.setStatus(id, orgId, dbStatus, timestamps);

    await this.logEvent(id, orgId, `campaign.${targetStatus}`, { fromStatus: currentStatus }, actorId);
    await this.logAudit(orgId, actorId, `campaign.${targetStatus}`, 'campaign', id, { fromStatus: currentStatus });

    const progress = await this.repo.getProgress(id);
    return this.toDomain(updated, progress);
  }

  async startCampaign(id: string, organizationId?: string, actorId?: string): Promise<Campaign> {
    return this.transitionState(id, 'running', organizationId, actorId);
  }

  async pauseCampaign(id: string, organizationId?: string, actorId?: string): Promise<Campaign> {
    return this.transitionState(id, 'paused', organizationId, actorId);
  }

  async resumeCampaign(id: string, organizationId?: string, actorId?: string): Promise<Campaign> {
    return this.transitionState(id, 'running', organizationId, actorId);
  }

  async completeCampaign(id: string, organizationId?: string, actorId?: string): Promise<Campaign> {
    return this.transitionState(id, 'completed', organizationId, actorId);
  }

  async cancelCampaign(id: string, organizationId?: string, actorId?: string): Promise<Campaign> {
    return this.transitionState(id, 'archived', organizationId, actorId);
  }

  async archiveCampaign(id: string, organizationId?: string, actorId?: string): Promise<Campaign> {
    return this.transitionState(id, 'archived', organizationId, actorId);
  }

  // =========================================================================
  // LEAD ELIGIBILITY & ENROLLMENT (STEP 6, 7, 19, 20)
  // =========================================================================

  /**
   * Asserts whether a lead is strictly eligible for campaign assignment.
   * Throws friendly user-facing error on any violation.
   */
  async assertLeadEligibleForCampaign(
    leadId: string,
    campaignId: string,
    organizationId?: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const lead = store.leads.find((l) => l.id === leadId);
      if (!lead || lead.organization_id !== orgId) {
        throw new Error('Lead not found or organization access denied');
      }
      if (lead.is_archived) {
        throw new Error(`Cannot assign "${lead.full_name}": Lead is archived.`);
      }
      if (lead.is_dnc || lead.status === 'dnc') {
        throw new Error(`Cannot assign "${lead.full_name}": Lead is protected on Do-Not-Call (DNC) list.`);
      }
      if (!lead.phone || lead.phone.trim().length < 7) {
        throw new Error(`Cannot assign "${lead.full_name}": Invalid telephone number.`);
      }

      const alreadyEnrolled = store.campaignLeads.some(
        (cl) => cl.campaign_id === campaignId && cl.lead_id === leadId
      );
      if (alreadyEnrolled) {
        throw new Error(`Lead "${lead.full_name}" is already assigned to this campaign.`);
      }

      return { eligible: true };
    }

    const lead = await this.leadsRepo.getById(leadId, orgId);
    if (!lead) {
      throw new Error('Lead not found or organization access denied');
    }
    const leadName = lead.name || lead.full_name || 'Contact';
    if (lead.deleted_at || lead.is_archived) {
      throw new Error(`Cannot assign "${leadName}": Lead is archived.`);
    }
    if (lead.do_not_call || lead.is_dnc || String(lead.status).toUpperCase() === 'DNC') {
      throw new Error(`Cannot assign "${leadName}": Lead is protected on Do-Not-Call (DNC) list.`);
    }
    if (!lead.phone || lead.phone.trim().length < 7) {
      throw new Error(`Cannot assign "${leadName}": Invalid telephone number.`);
    }

    const { data: existing } = await this.supabase
      .from('campaign_enrollments')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)
      .maybeSingle();

    if (existing) {
      throw new Error(`Lead "${leadName}" is already assigned to this campaign.`);
    }

    return { eligible: true };
  }

  /**
   * Bulk enrolls leads into a campaign with comprehensive validation and DNC protection.
   */
  async enrollLeads(
    campaignId: string,
    leadIds: string[],
    organizationId?: string,
    actorId?: string
  ): Promise<CampaignEnrollmentResult> {
    const orgId = organizationId ?? this.defaultOrgId;
    const campaign = await this.repo.getById(campaignId, orgId);
    if (!campaign) throw new Error('Campaign not found');

    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      throw new Error(`Cannot add leads to campaign in terminal state "${campaign.status}".`);
    }

    if (leadIds.length === 0) {
      return {
        added: 0,
        skipped: 0,
        dncProtected: 0,
        invalid: 0,
        alreadyAdded: 0,
        skippedCapacity: 0,
        totalProcessed: 0,
      };
    }

    // 1. Enforce 100-lead maximum campaign capacity limit
    const currentEnrolledCount = await this.repo.getEnrolledCount(campaignId);
    if (currentEnrolledCount >= 100) {
      throw new Error(
        `Cannot enroll leads: Campaign "${campaign.name}" has reached its maximum capacity of 100 leads (Current: ${currentEnrolledCount}).`
      );
    }

    const availableSlots = Math.max(0, 100 - currentEnrolledCount);

    let validLeadIdsToAdd: string[] = [];
    let skipped = 0;
    let dncProtected = 0;
    let invalid = 0;
    let alreadyAdded = 0;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const existingMemberships = new Set(
        store.campaignLeads.filter((cl) => cl.campaign_id === campaignId).map((cl) => cl.lead_id)
      );

      for (const id of leadIds) {
        const lead = store.leads.find((l) => l.id === id && l.organization_id === orgId);
        if (!lead || lead.is_archived) {
          invalid++;
          continue;
        }
        if (lead.is_dnc || lead.status === 'dnc') {
          dncProtected++;
          continue;
        }
        if (!lead.phone || lead.phone.trim().length < 7) {
          invalid++;
          continue;
        }
        if (existingMemberships.has(id)) {
          alreadyAdded++;
          continue;
        }
        validLeadIdsToAdd.push(id);
      }
    } else {
      // First attempt the atomic database RPC if available
      try {
        const { data: rpcData, error: rpcError } = await this.supabase.rpc('enroll_leads_in_campaign', {
          p_campaign_id: campaignId,
          p_lead_ids: leadIds,
          p_actor_id: actorId || null,
        } as any);

        if (!rpcError && rpcData && typeof rpcData === 'object') {
          const res = rpcData as Record<string, unknown>;
          const added = Number(res.enrolled_count ?? 0);
          const skippedDuplicate = Number(res.skipped_duplicate ?? 0);
          const skippedDnc = Number(res.skipped_dnc ?? 0);
          const skippedInvalid = Number(res.skipped_invalid ?? 0);
          const skippedCapacity = Number(res.skipped_capacity ?? 0);

          await this.logEvent(campaignId, orgId, 'campaign.leads_enrolled', {
            added,
            dncProtected: skippedDnc,
            invalid: skippedInvalid,
            alreadyAdded: skippedDuplicate,
            skippedCapacity,
          }, actorId);

          await this.logAudit(orgId, actorId, 'campaign.leads_enrolled', 'campaign', campaignId, {
            count: added,
            dncProtected: skippedDnc,
            skippedCapacity,
          });

          return {
            added,
            skipped: skippedDuplicate + skippedInvalid,
            dncProtected: skippedDnc,
            invalid: skippedInvalid,
            alreadyAdded: skippedDuplicate,
            skippedCapacity,
            totalProcessed: leadIds.length,
          };
        }
      } catch {
        // Fall back to TypeScript query logic
      }

      const { data: leads } = await this.supabase
        .from('leads')
        .select('id, name, do_not_call, status, deleted_at, phone')
        .eq('organization_id', orgId)
        .in('id', leadIds);

      const { data: existingCl } = await this.supabase
        .from('campaign_enrollments')
        .select('lead_id')
        .eq('campaign_id', campaignId);

      const existingMemberships = new Set((existingCl || []).map((cl) => cl.lead_id));
      const leadMap = new Map((leads || []).map((l) => [l.id, l]));

      for (const id of leadIds) {
        const lead = leadMap.get(id);
        if (!lead || lead.deleted_at) {
          invalid++;
          continue;
        }
        if (lead.do_not_call || String(lead.status).toUpperCase() === 'DNC') {
          dncProtected++;
          continue;
        }
        if (!lead.phone || lead.phone.trim().length < 7) {
          invalid++;
          continue;
        }
        if (existingMemberships.has(id)) {
          alreadyAdded++;
          continue;
        }
        validLeadIdsToAdd.push(id);
      }
    }

    // Apply 100-lead capacity slice
    const toEnroll = validLeadIdsToAdd.slice(0, availableSlots);
    const skippedCapacity = validLeadIdsToAdd.length - toEnroll.length;

    const added = await this.repo.addLeads(campaignId, toEnroll, orgId, actorId);

    await this.logEvent(campaignId, orgId, 'campaign.leads_enrolled', {
      added,
      dncProtected,
      invalid,
      alreadyAdded,
      skippedCapacity,
    }, actorId);

    await this.logAudit(orgId, actorId, 'campaign.leads_enrolled', 'campaign', campaignId, {
      count: added,
      dncProtected,
      skippedCapacity,
    });

    return {
      added,
      skipped,
      dncProtected,
      invalid,
      alreadyAdded,
      skippedCapacity,
      totalProcessed: leadIds.length,
    };
  }

  async removeLeadFromCampaign(campaignId: string, leadId: string, organizationId?: string): Promise<boolean> {
    const orgId = organizationId ?? this.defaultOrgId;
    const campaign = await this.repo.getById(campaignId, orgId);
    if (!campaign) throw new Error('Campaign not found');

    const removed = await this.repo.removeLead(campaignId, leadId);
    return removed;
  }

  async getEnrolledLeads(
    campaignId: string,
    options: { limit?: number; offset?: number; state?: string } = {}
  ): Promise<{ memberships: CampaignLeadMembership[]; totalCount: number }> {
    return this.repo.getLeadMemberships(campaignId, options);
  }

  // =========================================================================
  // QUEUE ENGINE & ATOMIC CANDIDATE SELECTION (STEP 11 - 15, 20 - 22)
  // =========================================================================

  /**
   * Retrieves and atomically claims the next eligible lead candidate for dialing.
   * Enforces calling hours, timezone rules, DNC dynamic checks, and concurrency leases.
   */
  async getNextCallableLead(
    campaignId: string,
    workerId: string = 'worker_local',
    organizationId?: string
  ): Promise<{ candidate: ClaimedLeadCandidate | null; reason?: string }> {
    const orgId = organizationId ?? this.defaultOrgId;
    const campaign = await this.repo.getById(campaignId, orgId);

    if (!campaign) {
      return { candidate: null, reason: 'Campaign not found' };
    }

    if (campaign.status !== 'running') {
      return {
        candidate: null,
        reason: `Campaign is currently "${campaign.status}". Dialing queue only active when running.`,
      };
    }

    // 1. Check campaign-level calling window (STEP 11)
    const windowCheck = isWithinCallingWindow({
      campaignTimezone: campaign.timezone,
      callingDays: campaign.calling_days,
      callingWindowStart: campaign.calling_window_start,
      callingWindowEnd: campaign.calling_window_end,
    });

    if (!windowCheck.isWithinWindow) {
      return {
        candidate: null,
        reason: windowCheck.reasonBlocked || 'Outside permissible campaign calling hours',
      };
    }

    // 2. Atomically claim next available candidate
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      const candidate = await this.repo.claimNextLead(campaignId, workerId);
      if (!candidate) {
        return { candidate: null, reason: 'No eligible leads waiting in queue' };
      }

      // 3. Dynamic DNC check (STEP 20) — Ensure lead hasn't been DNC'd since enrollment
      if (this.isMockDevMode) {
        const store = getDevStore();
        const liveLead = store.leads.find((l) => l.id === candidate.leadId);
        if (liveLead && (liveLead.is_dnc || liveLead.status === 'dnc')) {
          await this.repo.updateAttempt(candidate.campaignLeadId, 'dnc', null);
          continue; // Pick next candidate
        }
      } else {
        const { data: liveLead } = await this.supabase
          .from('leads')
          .select('is_dnc, status')
          .eq('id', candidate.leadId)
          .single();

        if (liveLead && (liveLead.is_dnc || liveLead.status === 'dnc')) {
          await this.repo.updateAttempt(candidate.campaignLeadId, 'dnc', null);
          continue;
        }
      }

      // 4. Recipient local timezone check (STEP 12)
      if (candidate.timezone && candidate.timezone !== campaign.timezone) {
        const leadWindowCheck = isWithinCallingWindow({
          campaignTimezone: campaign.timezone,
          leadTimezone: candidate.timezone,
          callingDays: campaign.calling_days,
          callingWindowStart: campaign.calling_window_start,
          callingWindowEnd: campaign.calling_window_end,
        });

        if (!leadWindowCheck.isWithinWindow) {
          // Release claim and postpone next attempt
          const postponeTime = new Date(Date.now() + 3600000 * 2).toISOString();
          await this.repo.releaseClaim(candidate.campaignLeadId);
          await this.repo.updateAttempt(candidate.campaignLeadId, 'outside_local_hours', postponeTime);
          continue;
        }
      }

      // Lead is fully eligible and atomically claimed
      return { candidate };
    }

    return { candidate: null, reason: 'Queue exhausted or all available candidates postponed' };
  }

  /**
   * Dispatches the next campaign lead based on the active AI_VOICE_RUNTIME ('retell' vs 'legacy').
   */
  async dispatchCampaignLead(
    campaignId: string,
    workerId: string = 'worker_campaign_queue',
    organizationId?: string,
    operatorId?: string
  ): Promise<CampaignDispatchResult | { mode: 'legacy'; candidate: ClaimedLeadCandidate | null; reason?: string }> {
    const orgId = organizationId ?? this.defaultOrgId;
    let runtime: 'legacy' | 'retell' = 'legacy';
    try {
      const env = getServerEnv();
      runtime = env.AI_VOICE_RUNTIME || 'legacy';
    } catch {
      runtime = 'legacy';
    }

    if (runtime === 'retell') {
      return this.retellDispatcher.dispatchNextCandidate(campaignId, workerId, orgId, operatorId);
    }

    // Legacy Runtime Path: Just retrieves and claims candidate for legacy worker
    const { candidate, reason } = await this.getNextCallableLead(campaignId, workerId, orgId);
    return {
      mode: 'legacy',
      candidate,
      reason,
    };
  }

  /**
   * Records execution outcome for a dialed campaign lead, scheduling retries or marking final.
   */
  async recordCallOutcome(
    campaignLeadId: string,
    outcome: string,
    campaignId: string,
    organizationId?: string
  ): Promise<void> {
    const orgId = organizationId ?? this.defaultOrgId;
    const campaign = await this.repo.getById(campaignId, orgId);
    if (!campaign) throw new Error('Campaign not found');

    const finalOutcomes = ['qualified', 'appointment', 'not_interested', 'wrong_contact', 'dnc'];
    const isFinal = finalOutcomes.includes(outcome.toLowerCase());

    if (isFinal) {
      await this.repo.completeLead(campaignLeadId, outcome);
      return;
    }

    // Retryable outcome (STEP 13): schedule next attempt if below max
    const retryDelayMs = (campaign.retry_delay_minutes || 60) * 60 * 1000;
    const nextAttemptAt = new Date(Date.now() + retryDelayMs).toISOString();

    await this.repo.updateAttempt(campaignLeadId, outcome, nextAttemptAt);
  }

  async getCampaignProgress(campaignId: string): Promise<CampaignProgressMetrics> {
    return this.repo.getProgress(campaignId);
  }

  private async logEvent(
    campaignId: string,
    organizationId: string,
    eventType: string,
    metadata: Record<string, unknown>,
    actorId?: string
  ): Promise<void> {
    if (this.isMockDevMode) {
      const store = getDevStore();
      store.campaignEvents.push({
        id: `ce_${Date.now()}`,
        organization_id: organizationId,
        campaign_id: campaignId,
        event_type: eventType,
        metadata,
        actor_user_id: actorId || null,
        created_at: new Date().toISOString(),
      });
      return;
    }

    if (typeof this.supabase?.from !== 'function') {
      return;
    }

    try {
      await this.supabase.from('campaign_events').insert({
        organization_id: organizationId,
        campaign_id: campaignId,
        event_type: eventType,
        metadata: metadata as Json,
        actor_user_id: actorId || null,
      });
    } catch (err) {
      console.warn('Campaign event log notice:', err);
    }
  }

  private async logAudit(
    organizationId: string,
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    if (this.isMockDevMode || typeof this.supabase?.from !== 'function') {
      return;
    }

    try {
      await this.supabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_user_id: actorId ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata as Json,
      });
    } catch (err) {
      console.warn('Audit logging notice:', err);
    }
  }
}
