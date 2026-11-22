import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CampaignStatusDb } from '@/lib/supabase/types';

export type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
export type CampaignUpdate = Database['public']['Tables']['campaigns']['Update'];

export interface CampaignProgressMetrics {
  totalLeads: number;
  attempted: number;
  remaining: number;
  connected: number;
  qualified: number;
  appointments: number;
  callbacks: number;
  dnc: number;
  failed: number;
  completed: number;
  progressPercent: number;
}

export interface CampaignLeadMembership {
  id: string;
  campaignId: string;
  leadId: string;
  state: 'queued' | 'calling' | 'completed' | 'abandoned' | string;
  attemptCount: number;
  outcome?: string | null;
  priority?: number;
  nextAttemptAt?: string | null;
  lead: {
    id: string;
    fullName: string;
    phone: string;
    companyName: string;
    email?: string | null;
    jobTitle?: string | null;
    status?: string;
  };
}

export interface ClaimedLeadCandidate {
  campaignLeadId: string;
  leadId: string;
  phone: string;
  timezone?: string | null;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  customFields?: Record<string, unknown>;
  attempts?: number;
}

export class CampaignsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  async list(
    orgId: string,
    options: { status?: string; search?: string; limit?: number; offset?: number } = {}
  ): Promise<{ campaigns: CampaignRow[]; totalCount: number }> {
    let query = this.supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId);

    if (options.status && options.status !== 'all') {
      if (options.status === 'active') {
        query = query.neq('status', 'archived');
      } else if (options.status === 'live' || options.status === 'running') {
        query = query.in('status', ['ready', 'running']);
      } else if (options.status === 'completed' || options.status === 'cancelled' || options.status === 'archived') {
        query = query.in('status', ['archived', 'completed', 'cancelled']);
      } else {
        query = query.eq('status', options.status as CampaignStatusDb);
      }
    } else if (!options.status) {
      // Default view: exclude archived campaigns from active campaign lists
      query = query.neq('status', 'archived');
    }

    if (options.search && options.search.trim()) {
      query = query.ilike('name', `%${options.search.trim()}%`);
    }

    query = query.order('created_at', { ascending: false });

    const limit = options.limit ?? 25;
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      campaigns: (data as CampaignRow[]) ?? [],
      totalCount: count ?? 0,
    };
  }

  async getById(id: string, orgId?: string): Promise<CampaignRow | null> {
    let query = this.supabase.from('campaigns').select('*').eq('id', id);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as CampaignRow | null) ?? null;
  }

  async create(input: CampaignInsert): Promise<CampaignRow> {
    const payload: Record<string, unknown> = {
      organization_id: input.organization_id,
      name: input.name,
      status: input.status ?? 'draft',
      agent_id: input.agent_id ?? (input as any).ai_agent_id ?? null,
      created_by: input.created_by ?? null,
      schedule_window:
        input.schedule_window ??
        JSON.stringify({
          start: (input as any).calling_window_start ?? '09:00',
          end: (input as any).calling_window_end ?? '17:00',
          days: (input as any).calling_days ?? [1, 2, 3, 4, 5],
          timezone: (input as any).timezone ?? 'UTC',
        }),
      retry_policy:
        input.retry_policy ??
        JSON.stringify({
          maxAttempts: (input as any).max_attempts_per_lead ?? 3,
          retryDelayMinutes: (input as any).retry_delay_minutes ?? 60,
          concurrencyLimit: (input as any).concurrency_limit ?? 10,
        }),
    };

    const { data, error } = await this.supabase
      .from('campaigns')
      .insert(payload as any)
      .select()
      .single();
    if (error) throw error;
    return data as CampaignRow;
  }

  async update(id: string, orgId: string, input: CampaignUpdate): Promise<CampaignRow> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) payload.name = input.name;
    if (input.status !== undefined) payload.status = input.status;
    if (input.agent_id !== undefined) payload.agent_id = input.agent_id;
    if ((input as any).ai_agent_id !== undefined && payload.agent_id === undefined) {
      payload.agent_id = (input as any).ai_agent_id;
    }
    if (input.created_by !== undefined) payload.created_by = input.created_by;
    if (input.schedule_window !== undefined) payload.schedule_window = input.schedule_window;
    if (input.retry_policy !== undefined) payload.retry_policy = input.retry_policy;

    const { data, error } = await this.supabase
      .from('campaigns')
      .update(payload as any)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();
    if (error) throw error;
    return data as CampaignRow;
  }

  async setStatus(
    id: string,
    orgId: string,
    status: string,
    additionalUpdates: Partial<CampaignUpdate> = {}
  ): Promise<CampaignRow> {
    return this.update(id, orgId, {
      status: status as CampaignStatusDb,
      ...additionalUpdates,
    });
  }

  async getProgress(id: string): Promise<CampaignProgressMetrics> {
    const { data: enrollments } = await this.supabase
      .from('campaign_enrollments')
      .select('id, lead_id')
      .eq('campaign_id', id);

    const totalLeads = enrollments?.length ?? 0;

    const { data: calls } = await this.supabase
      .from('call_sessions')
      .select('id, lead_id, status')
      .eq('campaign_id', id);

    const callList = calls ?? [];
    const attemptedLeads = new Set<string>();
    let connected = 0;
    let completed = 0;
    let failed = 0;

    for (const call of callList) {
      if (call.lead_id) attemptedLeads.add(call.lead_id);
      if (call.status === 'completed' || call.status === 'in_progress') connected++;
      if (call.status === 'completed') completed++;
      if (call.status === 'failed' || call.status === 'busy' || call.status === 'no_answer') failed++;
    }

    const attempted = attemptedLeads.size;
    const remaining = Math.max(0, totalLeads - attempted);
    const progressPercent = totalLeads > 0 ? Math.round((completed / totalLeads) * 100) : 0;

    return {
      totalLeads,
      attempted,
      remaining,
      connected,
      qualified: 0,
      appointments: 0,
      callbacks: 0,
      dnc: 0,
      failed,
      completed,
      progressPercent,
    };
  }

  async addLeads(campaignId: string, leadIds: string[], orgId?: string, actorId?: string): Promise<number> {
    if (leadIds.length === 0) return 0;
    let resolvedOrgId = orgId;
    if (!resolvedOrgId) {
      const camp = await this.getById(campaignId);
      resolvedOrgId = camp?.organization_id;
    }
    if (!resolvedOrgId) throw new Error('Cannot add leads without organization_id');

    const records = leadIds.map((leadId) => ({
      organization_id: resolvedOrgId,
      campaign_id: campaignId,
      lead_id: leadId,
      enrolled_by: actorId || null,
    }));

    const { error } = await this.supabase
      .from('campaign_enrollments')
      .upsert(records, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });

    if (error) throw error;
    return leadIds.length;
  }

  async removeLead(campaignId: string, leadId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('campaign_enrollments')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId);
    if (error) throw error;
    return true;
  }

  async getLeadMemberships(
    campaignId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ memberships: CampaignLeadMembership[]; totalCount: number }> {
    let query = this.supabase
      .from('campaign_enrollments')
      .select('id, campaign_id, lead_id, created_at', {
        count: 'exact',
      })
      .eq('campaign_id', campaignId);

    query = query.order('created_at', { ascending: true });

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return { memberships: [], totalCount: count ?? 0 };
    }

    const leadIds = rows.map((r) => r.lead_id);
    const { data: leadsData } = await this.supabase
      .from('leads')
      .select('id, name, phone, company, email, title, status')
      .in('id', leadIds);

    const leadMap = new Map((leadsData ?? []).map((l) => [l.id, l]));

    // Query calls in this campaign to determine state
    const { data: callsData } = await this.supabase
      .from('call_sessions')
      .select('id, lead_id, status, created_at')
      .eq('campaign_id', campaignId)
      .in('lead_id', leadIds);

    const callsByLead = new Map<string, number>();
    const latestCallStatus = new Map<string, string>();
    for (const c of callsData ?? []) {
      if (c.lead_id) {
        callsByLead.set(c.lead_id, (callsByLead.get(c.lead_id) ?? 0) + 1);
        latestCallStatus.set(c.lead_id, c.status);
      }
    }

    const memberships: CampaignLeadMembership[] = rows.map((r) => {
      const lead = leadMap.get(r.lead_id);
      const attempts = callsByLead.get(r.lead_id) ?? 0;
      const status = latestCallStatus.get(r.lead_id);
      const state = attempts > 0 ? (status === 'completed' ? 'completed' : 'calling') : 'queued';

      return {
        id: r.id,
        campaignId: r.campaign_id,
        leadId: r.lead_id,
        state,
        attemptCount: attempts,
        outcome: status ?? null,
        lead: {
          id: r.lead_id,
          fullName: lead?.name || 'Unknown Contact',
          phone: lead?.phone || '',
          companyName: lead?.company || 'Unknown Company',
          email: lead?.email ?? null,
          jobTitle: lead?.title ?? null,
          status: lead?.status ?? 'NEW',
        },
      };
    });

    return { memberships, totalCount: count ?? 0 };
  }

  async claimNextLead(
    campaignId: string,
    _workerId: string = 'worker_default'
  ): Promise<ClaimedLeadCandidate | null> {
    const { data: enrollments, error: enrollError } = await this.supabase
      .from('campaign_enrollments')
      .select('id, lead_id')
      .eq('campaign_id', campaignId);

    if (enrollError || !enrollments || enrollments.length === 0) return null;

    const { data: calls } = await this.supabase
      .from('call_sessions')
      .select('lead_id')
      .eq('campaign_id', campaignId);

    const calledLeadIds = new Set((calls ?? []).map((c) => c.lead_id).filter(Boolean));
    const nextCandidate = enrollments.find((e) => !calledLeadIds.has(e.lead_id));
    if (!nextCandidate) return null;

    const { data: lead, error: leadError } = await this.supabase
      .from('leads')
      .select('id, phone, name, company, title, notes')
      .eq('id', nextCandidate.lead_id)
      .single();

    if (leadError || !lead) return null;

    const [firstName = '', ...rest] = (lead.name ?? '').split(' ');
    const lastName = rest.join(' ');

    return {
      campaignLeadId: nextCandidate.id,
      leadId: lead.id,
      phone: lead.phone,
      timezone: 'UTC',
      fullName: lead.name,
      firstName,
      lastName,
      companyName: lead.company,
      jobTitle: lead.title,
      customFields: {},
      attempts: 0,
    };
  }

  async updateAttempt(
    _campaignLeadId: string,
    _outcome: string,
    _nextAttemptAt: string | null
  ): Promise<void> {
    // Attempt tracking is handled via call_sessions in the remote schema
  }

  async releaseClaim(_campaignLeadId: string): Promise<void> {
    // Claim tracking is handled via call_sessions in the remote schema
  }

  async completeLead(_campaignLeadId: string, _outcome: string): Promise<void> {
    // Completion tracking is handled via call_sessions in the remote schema
  }
}
