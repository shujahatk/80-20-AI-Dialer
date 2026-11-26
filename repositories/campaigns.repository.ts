import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CampaignStatusDb } from '@/lib/supabase/types';
import { isMockDevMode } from '@/lib/env';
import { getDevStore } from '@/lib/dev/dev-store';

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

export interface CampaignEmailConfig {
  instructions?: string | null;
  qualificationCriteria?: Record<string, unknown> | null;
  requiredCommercialInfo?: string[] | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  companySignature?: string | null;
  attachments?: string[] | null;
}

export function packCampaignInstructions(input: Record<string, any>): string | null {
  const structured: CampaignEmailConfig = {
    instructions: input.emailInstructions ?? input.email_instructions ?? null,
    qualificationCriteria: input.qualificationCriteria ?? null,
    requiredCommercialInfo: input.requiredCommercialInfo ?? null,
    emailSubject: input.emailSubject ?? null,
    emailBody: input.emailBody ?? null,
    companySignature: input.companySignature ?? null,
    attachments: input.attachments ?? [],
  };
  if (
    structured.qualificationCriteria ||
    (structured.requiredCommercialInfo && structured.requiredCommercialInfo.length > 0) ||
    structured.emailSubject ||
    structured.emailBody ||
    structured.companySignature ||
    (structured.attachments && structured.attachments.length > 0)
  ) {
    return JSON.stringify(structured);
  }
  return structured.instructions ?? null;
}

export function unpackCampaignInstructions(raw?: string | null): CampaignEmailConfig {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as CampaignEmailConfig;
    } catch {
      return { instructions: raw };
    }
  }
  return { instructions: raw };
}

export class CampaignsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  private enrichCampaignRow(row: any): CampaignRow {
    if (!row) return row;
    row.ai_agent_id = row.agent_id ?? row.ai_agent_id ?? null;
    row.aiAgentId = row.agent_id ?? row.ai_agent_id ?? null;
    if (row.schedule_window && typeof row.schedule_window === 'string' && row.schedule_window.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(row.schedule_window.trim());
        if (parsed.emailFollowupEnabled !== undefined) {
          row.email_followup_enabled = Boolean(parsed.emailFollowupEnabled);
          row.emailFollowupEnabled = Boolean(parsed.emailFollowupEnabled);
        }
        if (parsed.emailLawfulBasis !== undefined) {
          row.email_lawful_basis = parsed.emailLawfulBasis;
          row.emailLawfulBasis = parsed.emailLawfulBasis;
        }
        if (parsed.emailLawfulBasisNote !== undefined) {
          row.email_lawful_basis_note = parsed.emailLawfulBasisNote;
          row.emailLawfulBasisNote = parsed.emailLawfulBasisNote;
        }
        if (parsed.emailInstructions !== undefined) {
          row.email_instructions = parsed.emailInstructions;
          row.emailInstructions = parsed.emailInstructions;
          const unpacked = unpackCampaignInstructions(parsed.emailInstructions);
          row.emailSubject = unpacked.emailSubject;
          row.emailBody = unpacked.emailBody;
          row.companySignature = unpacked.companySignature;
          row.attachments = unpacked.attachments;
          row.qualificationCriteria = unpacked.qualificationCriteria;
          row.requiredCommercialInfo = unpacked.requiredCommercialInfo;
        }
      } catch {}
    }
    return row as CampaignRow;
  }

  async enrollLeads(campaignId: string, leadIds: string[], orgId?: string, actorId?: string): Promise<number> {
    return this.addLeads(campaignId, leadIds, orgId, actorId);
  }

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
      campaigns: ((data as any[]) ?? []).map((row) => this.enrichCampaignRow(row)),
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
    return data ? this.enrichCampaignRow(data) : null;
  }

  async create(input: CampaignInsert): Promise<CampaignRow> {
    const instructions = packCampaignInstructions(input as any);
    const followupEnabled = Boolean((input as any).emailFollowupEnabled ?? (input as any).email_followup_enabled);
    const lawfulBasis = (input as any).emailLawfulBasis ?? (input as any).email_lawful_basis ?? 'legitimate_interest_documented';
    const lawfulBasisNote = (input as any).emailLawfulBasisNote ?? (input as any).email_lawful_basis_note ?? 'B2B commercial discussion';

    const scheduleWindowData = {
      window: {
        start: (input as any).calling_window_start ?? (input as any).callingWindowStart ?? '09:00',
        end: (input as any).calling_window_end ?? (input as any).callingWindowEnd ?? '17:00',
        days: (input as any).calling_days ?? (input as any).callingDays ?? [1, 2, 3, 4, 5],
        timezone: (input as any).timezone ?? 'UTC',
      },
      emailFollowupEnabled: followupEnabled,
      emailLawfulBasis: lawfulBasis,
      emailLawfulBasisNote: lawfulBasisNote,
      emailInstructions: instructions,
    };

    const payload: Record<string, unknown> = {
      organization_id: input.organization_id ?? (input as any).organizationId ?? (input as any).orgId,
      name: input.name,
      status: input.status ?? 'draft',
      agent_id: input.agent_id ?? (input as any).ai_agent_id ?? null,
      created_by: input.created_by ?? null,
      schedule_window: JSON.stringify(scheduleWindowData),
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
    return this.enrichCampaignRow(data);
  }

  async update(id: string, orgId: string, input: CampaignUpdate): Promise<CampaignRow> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) payload.name = input.name;
    if (input.status !== undefined) payload.status = input.status;
    if (input.agent_id !== undefined || (input as any).ai_agent_id !== undefined) {
      payload.agent_id = input.agent_id ?? (input as any).ai_agent_id ?? null;
    }
    if (input.created_by !== undefined) payload.created_by = input.created_by;
    if (input.retry_policy !== undefined) payload.retry_policy = input.retry_policy;

    if (
      (input as any).emailFollowupEnabled !== undefined ||
      (input as any).email_followup_enabled !== undefined ||
      (input as any).emailSubject !== undefined ||
      (input as any).emailBody !== undefined ||
      input.schedule_window !== undefined
    ) {
      const existing = await this.getById(id, orgId);
      const existingWindow = existing?.schedule_window ? (typeof existing.schedule_window === 'string' && existing.schedule_window.startsWith('{') ? JSON.parse(existing.schedule_window) : {}) : {};
      const instructions = packCampaignInstructions(input as any) || existingWindow.emailInstructions;
      const followupEnabled = (input as any).emailFollowupEnabled ?? (input as any).email_followup_enabled ?? existingWindow.emailFollowupEnabled ?? false;
      const lawfulBasis = (input as any).emailLawfulBasis ?? (input as any).email_lawful_basis ?? existingWindow.emailLawfulBasis ?? 'consent';
      const lawfulBasisNote = (input as any).emailLawfulBasisNote ?? (input as any).email_lawful_basis_note ?? existingWindow.emailLawfulBasisNote ?? null;

      payload.schedule_window = JSON.stringify({
        ...existingWindow,
        emailFollowupEnabled: followupEnabled,
        emailLawfulBasis: lawfulBasis,
        emailLawfulBasisNote: lawfulBasisNote,
        emailInstructions: instructions,
      });
    }

    const { data, error } = await this.supabase
      .from('campaigns')
      .update(payload as any)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();
    if (error) throw error;
    return this.enrichCampaignRow(data);
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

    if (isMockDevMode()) {
      const store = getDevStore();
      const existingMemberships = new Set(
        store.campaignLeads.filter((cl) => cl.campaign_id === campaignId).map((cl) => cl.lead_id)
      );
      let added = 0;
      for (const leadId of leadIds) {
        if (!existingMemberships.has(leadId)) {
          store.campaignLeads.push({
            id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            organization_id: resolvedOrgId,
            campaign_id: campaignId,
            lead_id: leadId,
            state: 'queued',
            attempt_count: 0,
            outcome: null,
            next_attempt_at: null,
            created_at: new Date().toISOString(),
          } as any);
          existingMemberships.add(leadId);
          added++;
        }
      }
      return added;
    }

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

  async findActiveCampaign(orgId: string, excludeId?: string): Promise<CampaignRow | null> {
    if (isMockDevMode()) {
      const store = getDevStore();
      const match = store.campaigns.find(
        (c) =>
          c.organization_id === orgId &&
          (c.status === 'running' || (c.status as string) === 'active') &&
          (!excludeId || c.id !== excludeId)
      );
      return (match as CampaignRow) ?? null;
    }

    let query = this.supabase
      .from('campaigns')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'running');

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    return (data as CampaignRow) ?? null;
  }

  async getEnrolledCount(campaignId: string): Promise<number> {
    if (isMockDevMode()) {
      const store = getDevStore();
      return store.campaignLeads.filter((cl) => cl.campaign_id === campaignId).length;
    }

    const { count, error } = await this.supabase
      .from('campaign_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    if (error) throw error;
    return count ?? 0;
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
