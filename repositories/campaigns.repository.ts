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
  unqualified?: number;
  pendingRetries?: number;
  emailsSent?: number;
  emailsDelivered?: number;
  emailsBounced?: number;
}

export interface CampaignLeadMembership {
  id: string;
  campaignId: string;
  leadId: string;
  state: 'queued' | 'calling' | 'completed' | 'abandoned' | string;
  attemptCount: number;
  maxAttempts?: number;
  outcome?: string | null;
  qualificationOutcome?: string | null;
  priority?: number;
  nextAttemptAt?: string | null;
  lastAttemptAt?: string | null;
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
  desiredOutcome?: string | null;
  qualificationCriteria?: Record<string, unknown> | null;
  requiredCommercialInfo?: string[] | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  companySignature?: string | null;
  attachments?: string[] | null;
}

export function packCampaignInstructions(input: Record<string, any>): string | null {
  const qualCriteria = input.qualificationCriteria
    ? {
        ...input.qualificationCriteria,
        ...(input.desiredOutcome ? { desiredOutcome: input.desiredOutcome } : {}),
      }
    : input.desiredOutcome
    ? { desiredOutcome: input.desiredOutcome }
    : null;

  const structured: CampaignEmailConfig = {
    instructions: input.emailInstructions ?? input.email_instructions ?? null,
    desiredOutcome: input.desiredOutcome ?? input.qualificationCriteria?.desiredOutcome ?? null,
    qualificationCriteria: qualCriteria,
    requiredCommercialInfo: input.requiredCommercialInfo ?? null,
    emailSubject: input.emailSubject ?? null,
    emailBody: input.emailBody ?? null,
    companySignature: input.companySignature ?? null,
    attachments: input.attachments ?? [],
  };
  if (
    structured.desiredOutcome ||
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
      const parsed = JSON.parse(trimmed) as CampaignEmailConfig;
      if (!parsed.desiredOutcome && parsed.qualificationCriteria && typeof parsed.qualificationCriteria === 'object') {
        parsed.desiredOutcome = (parsed.qualificationCriteria as any).desiredOutcome ?? null;
      }
      return parsed;
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

    if (row.retry_policy && typeof row.retry_policy === 'string' && row.retry_policy.trim().startsWith('{')) {
      try {
        const rp = JSON.parse(row.retry_policy.trim());
        row.max_attempts_per_lead = rp.maxAttempts ?? row.max_attempts_per_lead ?? 3;
        row.retry_delay_minutes = rp.retryDelayMinutes ?? row.retry_delay_minutes ?? 60;
        row.concurrency_limit = rp.concurrencyLimit ?? row.concurrency_limit ?? 10;
        row.daily_attempt_limit = rp.dailyAttemptLimit ?? row.daily_attempt_limit ?? 500;
      } catch {}
    } else {
      row.max_attempts_per_lead = row.max_attempts_per_lead ?? 3;
      row.retry_delay_minutes = row.retry_delay_minutes ?? 60;
      row.concurrency_limit = row.concurrency_limit ?? 10;
    }

    if (row.schedule_window && typeof row.schedule_window === 'string' && row.schedule_window.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(row.schedule_window.trim());
        const win = parsed.window || parsed;
        row.calling_window_start = win.start ?? row.calling_window_start ?? '09:00';
        row.calling_window_end = win.end ?? row.calling_window_end ?? '17:00';
        row.calling_days = win.days ?? row.calling_days ?? [1, 2, 3, 4, 5];
        row.timezone = win.timezone ?? row.timezone ?? 'UTC';

        if (parsed.description !== undefined) row.description = parsed.description;
        if (parsed.scheduledAt !== undefined) {
          row.scheduled_at = parsed.scheduledAt;
          row.scheduledAt = parsed.scheduledAt;
          row.start_date = parsed.scheduledAt || row.start_date || null;
        }
        if (parsed.startedAt !== undefined) {
          row.started_at = parsed.startedAt;
          row.startedAt = parsed.startedAt;
        }
        if (parsed.completedAt !== undefined) {
          row.completed_at = parsed.completedAt;
          row.completedAt = parsed.completedAt;
        }
        if (parsed.desiredOutcome !== undefined) {
          row.desiredOutcome = parsed.desiredOutcome;
        }
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
          if (!row.desiredOutcome && unpacked.desiredOutcome) {
            row.desiredOutcome = unpacked.desiredOutcome;
          }
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
    const scheduledAt = (input as any).scheduledAt ?? (input as any).scheduled_at ?? (input as any).start_date ?? (input as any).startDate ?? null;
    const desiredOutcome = (input as any).desiredOutcome ?? (input as any).qualificationCriteria?.desiredOutcome ?? null;

    const scheduleWindowData = {
      window: {
        start: (input as any).calling_window_start ?? (input as any).callingWindowStart ?? '09:00',
        end: (input as any).calling_window_end ?? (input as any).callingWindowEnd ?? '17:00',
        days: (input as any).calling_days ?? (input as any).callingDays ?? [1, 2, 3, 4, 5],
        timezone: (input as any).timezone ?? 'UTC',
      },
      description: (input as any).description ?? '',
      scheduledAt,
      startedAt: input.status === 'running' ? new Date().toISOString() : null,
      completedAt: null,
      desiredOutcome,
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
          maxAttempts: (input as any).max_attempts_per_lead ?? (input as any).maxAttemptsPerLead ?? 3,
          retryDelayMinutes: (input as any).retry_delay_minutes ?? (input as any).retryDelayMinutes ?? 60,
          concurrencyLimit: (input as any).concurrency_limit ?? (input as any).concurrencyLimit ?? 10,
          dailyAttemptLimit: (input as any).daily_attempt_limit ?? (input as any).dailyAttemptLimit ?? 500,
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
    if (input.agent_id !== undefined || (input as any).ai_agent_id !== undefined || (input as any).aiAgentId !== undefined) {
      payload.agent_id = input.agent_id ?? (input as any).ai_agent_id ?? (input as any).aiAgentId ?? null;
    }
    if (input.created_by !== undefined) payload.created_by = input.created_by;

    const existing = await this.getById(id, orgId);
    const existingWindow =
      existing?.schedule_window && typeof existing.schedule_window === 'string' && existing.schedule_window.trim().startsWith('{')
        ? JSON.parse(existing.schedule_window.trim())
        : {};
    const existingRetry =
      existing?.retry_policy && typeof existing.retry_policy === 'string' && existing.retry_policy.trim().startsWith('{')
        ? JSON.parse(existing.retry_policy.trim())
        : {};

    if (input.retry_policy !== undefined) {
      payload.retry_policy = input.retry_policy;
    } else if (
      (input as any).maxAttemptsPerLead !== undefined ||
      (input as any).max_attempts_per_lead !== undefined ||
      (input as any).retryDelayMinutes !== undefined ||
      (input as any).retry_delay_minutes !== undefined ||
      (input as any).concurrencyLimit !== undefined ||
      (input as any).concurrency_limit !== undefined
    ) {
      payload.retry_policy = JSON.stringify({
        ...existingRetry,
        maxAttempts: (input as any).maxAttemptsPerLead ?? (input as any).max_attempts_per_lead ?? existingRetry.maxAttempts ?? 3,
        retryDelayMinutes: (input as any).retryDelayMinutes ?? (input as any).retry_delay_minutes ?? existingRetry.retryDelayMinutes ?? 60,
        concurrencyLimit: (input as any).concurrencyLimit ?? (input as any).concurrency_limit ?? existingRetry.concurrencyLimit ?? 10,
      });
    }

    const instructions = packCampaignInstructions(input as any) || existingWindow.emailInstructions;
    const followupEnabled =
      (input as any).emailFollowupEnabled ??
      (input as any).email_followup_enabled ??
      existingWindow.emailFollowupEnabled ??
      false;
    const lawfulBasis =
      (input as any).emailLawfulBasis ??
      (input as any).email_lawful_basis ??
      existingWindow.emailLawfulBasis ??
      'legitimate_interest_documented';
    const lawfulBasisNote =
      (input as any).emailLawfulBasisNote ??
      (input as any).email_lawful_basis_note ??
      existingWindow.emailLawfulBasisNote ??
      'B2B commercial discussion';

    const win = existingWindow.window || {};
    const updatedWindow = {
      ...existingWindow,
      window: {
        start: (input as any).callingWindowStart ?? (input as any).calling_window_start ?? win.start ?? '09:00',
        end: (input as any).callingWindowEnd ?? (input as any).calling_window_end ?? win.end ?? '17:00',
        days: (input as any).callingDays ?? (input as any).calling_days ?? win.days ?? [1, 2, 3, 4, 5],
        timezone: (input as any).timezone ?? win.timezone ?? 'UTC',
      },
      description: (input as any).description ?? existingWindow.description ?? '',
      scheduledAt:
        (input as any).scheduledAt !== undefined
          ? (input as any).scheduledAt
          : (input as any).startDate !== undefined
          ? (input as any).startDate
          : existingWindow.scheduledAt ?? null,
      startedAt: (input as any).started_at ?? (input as any).startedAt ?? existingWindow.startedAt ?? null,
      completedAt: (input as any).completed_at ?? (input as any).completedAt ?? existingWindow.completedAt ?? null,
      desiredOutcome: (input as any).desiredOutcome ?? existingWindow.desiredOutcome ?? null,
      emailFollowupEnabled: followupEnabled,
      emailLawfulBasis: lawfulBasis,
      emailLawfulBasisNote: lawfulBasisNote,
      emailInstructions: instructions,
    };

    payload.schedule_window = input.schedule_window ?? JSON.stringify(updatedWindow);

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
      .select('*')
      .eq('campaign_id', id);

    const enrollmentList = (enrollments as any[]) ?? [];
    const totalLeads = enrollmentList.length;

    const { data: calls } = await this.supabase
      .from('call_sessions')
      .select('id, lead_id, status')
      .eq('campaign_id', id);

    const callList = calls ?? [];
    const callIds = callList.map((c) => c.id);

    let outcomeList: any[] = [];
    if (callIds.length > 0) {
      const { data: outcomes } = await this.supabase
        .from('call_outcomes')
        .select('call_session_id, disposition')
        .in('call_session_id', callIds);
      outcomeList = outcomes ?? [];
    }

    let emailList: any[] = [];
    try {
      const { data: emails } = await this.supabase
        .from('email_messages')
        .select('id, status')
        .eq('campaign_id', id);
      emailList = emails ?? [];
    } catch {}

    const outcomeByCallId = new Map<string, string>();
    for (const o of outcomeList) {
      if (o.call_session_id && o.disposition) {
        outcomeByCallId.set(o.call_session_id, String(o.disposition).toUpperCase());
      }
    }

    const attemptedLeads = new Set<string>();
    let connected = 0;
    let completed = 0;
    let failed = 0;
    let qualified = 0;
    let unqualified = 0;
    let callbacks = 0;
    let dnc = 0;

    for (const call of callList) {
      if (call.lead_id) attemptedLeads.add(call.lead_id);
      if (call.status === 'completed' || call.status === 'in_progress') connected++;
      if (call.status === 'completed') completed++;
      if (call.status === 'failed' || call.status === 'busy' || call.status === 'no_answer') failed++;

      const disp = outcomeByCallId.get(call.id) || '';
      if (disp === 'QUALIFIED') qualified++;
      else if (disp === 'NOT_QUALIFIED' || disp === 'NOT_INTERESTED' || disp === 'REJECTED') unqualified++;
      else if (disp === 'CALLBACK_REQUESTED' || disp === 'CALLBACK') callbacks++;
      else if (disp === 'DO_NOT_CALL' || disp === 'DNC') dnc++;
    }

    let pendingRetries = 0;
    let processedLeads = 0;
    for (const e of enrollmentList) {
      const eState = String(e.state || 'queued');
      const eAttempts = Number(e.attempt_count ?? 0);
      if (eState === 'completed' || eState === 'dnc' || eState === 'abandoned') {
        processedLeads++;
      } else if (eState === 'queued' && eAttempts > 0) {
        pendingRetries++;
      }
    }

    const attempted = Math.max(attemptedLeads.size, processedLeads + pendingRetries);
    const remaining = Math.max(0, totalLeads - processedLeads);
    const effectiveCompleted = Math.max(completed, processedLeads);
    const progressPercent = totalLeads > 0 ? Math.min(100, Math.round((effectiveCompleted / totalLeads) * 100)) : 0;

    const emailsSent = emailList.filter((m) => ['accepted', 'delivered', 'sending', 'bounced'].includes(String(m.status))).length;
    const emailsDelivered = emailList.filter((m) => m.status === 'delivered' || m.status === 'accepted').length;
    const emailsBounced = emailList.filter((m) => m.status === 'bounced' || m.status === 'failed').length;

    return {
      totalLeads,
      attempted,
      remaining,
      connected,
      qualified,
      appointments: qualified,
      callbacks,
      dnc,
      failed,
      completed: effectiveCompleted,
      progressPercent,
      unqualified,
      pendingRetries,
      emailsSent,
      emailsDelivered,
      emailsBounced,
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
      .select('*', {
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

    const enrollmentRows = rows as any[];
    const leadIds = enrollmentRows.map((r) => r.lead_id);
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

    const memberships: CampaignLeadMembership[] = enrollmentRows.map((r) => {
      const lead = leadMap.get(r.lead_id);
      const callAttempts = callsByLead.get(r.lead_id) ?? 0;
      const attempts = Math.max(Number(r.attempt_count ?? 0), callAttempts);
      const status = r.outcome || latestCallStatus.get(r.lead_id);
      const state =
        r.state && r.state !== 'queued'
          ? r.state
          : attempts > 0 && !r.next_attempt_at
          ? status === 'completed' || status === 'qualified'
            ? 'completed'
            : r.state || 'queued'
          : 'queued';

      return {
        id: r.id,
        campaignId: r.campaign_id,
        leadId: r.lead_id,
        state,
        attemptCount: attempts,
        maxAttempts: Number(r.max_attempts ?? 3),
        outcome: status ?? null,
        qualificationOutcome: r.qualification_outcome ?? null,
        nextAttemptAt: r.next_attempt_at ?? null,
        lastAttemptAt: r.last_attempt_at ?? null,
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

  /**
   * Atomically claims the next eligible lead candidate from the campaign queue.
   * Supports up to maxAttempts (default 3) retries for 'no_answer' and 'busy' outcomes
   * after the configured retry delay, while never retrying qualified, DNC, voicemail, or terminal leads.
   */
  async claimNextLead(
    campaignId: string,
    workerId: string = 'worker_default'
  ): Promise<ClaimedLeadCandidate | null> {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (isMockDevMode()) {
      const store = getDevStore();
      const candidateRow = store.campaignLeads.find((cl: any) => {
        if (cl.campaign_id !== campaignId) return false;
        if (cl.state === 'completed' || cl.state === 'dnc' || cl.state === 'abandoned') return false;
        if (cl.state === 'calling') return false;
        const maxAtt = Number(cl.max_attempts ?? 3);
        const att = Number(cl.attempt_count ?? 0);
        if (att >= maxAtt) return false;
        if (cl.next_attempt_at && new Date(cl.next_attempt_at).getTime() > nowMs) return false;
        return true;
      });
      if (!candidateRow) return null;
      candidateRow.state = 'calling';
      const lead = store.leads.find((l) => l.id === candidateRow.lead_id);
      if (!lead) return null;
      const [firstName = '', ...rest] = (lead.full_name ?? '').split(' ');
      return {
        campaignLeadId: candidateRow.id,
        leadId: lead.id,
        phone: lead.phone,
        timezone: lead.timezone || 'UTC',
        fullName: lead.full_name,
        firstName,
        lastName: rest.join(' '),
        companyName: lead.company_name || '',
        jobTitle: lead.job_title || '',
        customFields: {},
        attempts: Number(candidateRow.attempt_count ?? 0),
      };
    }

    const campaign = await this.getById(campaignId).catch(() => null);
    const campaignMaxAttempts = Number((campaign as any)?.max_attempts_per_lead ?? 3);

    const { data: enrollments, error: enrollError } = await this.supabase
      .from('campaign_enrollments')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (enrollError || !enrollments || enrollments.length === 0) return null;

    const { data: calls } = await this.supabase
      .from('call_sessions')
      .select('id, lead_id, status, disconnection_reason, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    const callsByLead = new Map<string, any[]>();
    const activeLeadIds = new Set<string>();
    const activeStatuses = new Set(['queued', 'in_progress', 'ringing', 'initiated', 'registered']);

    for (const c of calls ?? []) {
      if (!c.lead_id) continue;
      const list = callsByLead.get(c.lead_id) ?? [];
      list.push(c);
      callsByLead.set(c.lead_id, list);
      if (activeStatuses.has(String(c.status))) {
        activeLeadIds.add(c.lead_id);
      }
    }

    const retryableOutcomes = new Set([
      'no_answer',
      'busy',
      'outside_local_hours',
      'already_in_call',
      'canary_filtered',
      'provider_failed',
    ]);

    const terminalQualificationOutcomes = new Set([
      'QUALIFIED',
      'DO_NOT_CALL',
      'DNC',
      'CALLBACK_REQUESTED',
      'NOT_INTERESTED',
      'NOT_QUALIFIED',
      'REJECTED',
      'VOICEMAIL',
    ]);

    for (const rawEnrollment of enrollments as any[]) {
      const leadId = rawEnrollment.lead_id;
      if (!leadId || activeLeadIds.has(leadId)) continue;

      const state = String(rawEnrollment.state || 'queued');
      if (state === 'completed' || state === 'dnc' || state === 'abandoned') continue;

      if (state === 'calling' && rawEnrollment.claimed_at) {
        const claimedAgeMs = nowMs - new Date(rawEnrollment.claimed_at).getTime();
        if (claimedAgeMs < 5 * 60 * 1000) {
          continue;
        }
      }

      const qualOutcome = String(rawEnrollment.qualification_outcome || '').toUpperCase();
      if (qualOutcome && terminalQualificationOutcomes.has(qualOutcome)) {
        continue;
      }

      const leadCalls = callsByLead.get(leadId) ?? [];
      const attemptCount = Math.max(Number(rawEnrollment.attempt_count ?? 0), leadCalls.length);
      const maxAttempts = Number(rawEnrollment.max_attempts ?? campaignMaxAttempts ?? 3);

      if (attemptCount >= maxAttempts) {
        continue;
      }

      if (attemptCount > 0) {
        const lastCall = leadCalls[leadCalls.length - 1];
        const lastOutcome = String(
          rawEnrollment.outcome ||
            lastCall?.status ||
            lastCall?.disconnection_reason ||
            ''
        ).toLowerCase();

        const isRetryable =
          retryableOutcomes.has(lastOutcome) ||
          lastOutcome.includes('no_answer') ||
          lastOutcome.includes('busy');

        if (!isRetryable) {
          continue;
        }

        if (rawEnrollment.next_attempt_at) {
          const nextMs = new Date(rawEnrollment.next_attempt_at).getTime();
          if (!Number.isNaN(nextMs) && nextMs > nowMs) {
            continue;
          }
        }
      }

      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .select('id, phone, name, company, title, notes, do_not_call, status, deleted_at')
        .eq('id', leadId)
        .single();

      if (leadError || !lead || (lead as any).deleted_at) {
        continue;
      }

      if ((lead as any).do_not_call || String((lead as any).status).toUpperCase() === 'DNC') {
        try {
          await this.supabase
            .from('campaign_enrollments')
            .update({ state: 'completed', outcome: 'dnc', updated_at: nowIso } as any)
            .eq('id', rawEnrollment.id);
        } catch {}
        continue;
      }

      // Claim enrollment row
      try {
        await this.supabase
          .from('campaign_enrollments')
          .update({
            state: 'calling',
            claimed_by: workerId,
            claimed_at: nowIso,
            updated_at: nowIso,
          } as any)
          .eq('id', rawEnrollment.id);
      } catch {}

      const [firstName = '', ...rest] = (lead.name ?? '').split(' ');
      const lastName = rest.join(' ');

      return {
        campaignLeadId: rawEnrollment.id,
        leadId: lead.id,
        phone: lead.phone,
        timezone: 'UTC',
        fullName: lead.name,
        firstName,
        lastName,
        companyName: lead.company,
        jobTitle: lead.title,
        customFields: {},
        attempts: attemptCount,
      };
    }

    return null;
  }

  async updateAttempt(
    campaignLeadId: string,
    outcome: string,
    nextAttemptAt: string | null
  ): Promise<void> {
    const nowIso = new Date().toISOString();

    if (isMockDevMode()) {
      const store = getDevStore();
      const row = store.campaignLeads.find((cl) => cl.id === campaignLeadId) as any;
      if (row) {
        if (outcome === 'calling') {
          row.state = 'calling';
          row.last_attempt_at = nowIso;
        } else if (outcome === 'dnc' || outcome === 'invalid_number') {
          row.state = 'completed';
          row.outcome = outcome;
          row.next_attempt_at = null;
        } else {
          if (!['outside_local_hours', 'already_in_call', 'canary_filtered'].includes(outcome)) {
            row.attempt_count = Number(row.attempt_count ?? 0) + 1;
          }
          row.outcome = outcome;
          row.next_attempt_at = nextAttemptAt;
          row.state = nextAttemptAt && row.attempt_count < Number(row.max_attempts ?? 3) ? 'queued' : 'completed';
        }
      }
      return;
    }

    try {
      const { data: existing } = await this.supabase
        .from('campaign_enrollments')
        .select('*')
        .eq('id', campaignLeadId)
        .maybeSingle();

      const row = existing as any;
      if (!row) return;

      if (outcome === 'calling') {
        await this.supabase
          .from('campaign_enrollments')
          .update({
            state: 'calling',
            last_attempt_at: nowIso,
            updated_at: nowIso,
          } as any)
          .eq('id', campaignLeadId);
        return;
      }

      if (outcome === 'dnc' || outcome === 'invalid_number') {
        await this.supabase
          .from('campaign_enrollments')
          .update({
            state: 'completed',
            outcome,
            next_attempt_at: null,
            claimed_by: null,
            claimed_at: null,
            updated_at: nowIso,
          } as any)
          .eq('id', campaignLeadId);
        return;
      }

      const isPostpone = ['outside_local_hours', 'already_in_call', 'canary_filtered'].includes(outcome);
      const currentAttempts = Number(row.attempt_count ?? 0);
      const maxAttempts = Number(row.max_attempts ?? 3);
      const nextAttempts = isPostpone ? currentAttempts : currentAttempts + 1;
      const canRetry = Boolean(nextAttemptAt) && nextAttempts < maxAttempts;

      await this.supabase
        .from('campaign_enrollments')
        .update({
          state: canRetry ? 'queued' : 'completed',
          attempt_count: nextAttempts,
          outcome,
          next_attempt_at: canRetry ? nextAttemptAt : null,
          last_attempt_at: nowIso,
          claimed_by: null,
          claimed_at: null,
          updated_at: nowIso,
        } as any)
        .eq('id', campaignLeadId);
    } catch {}
  }

  async recordAttemptAndScheduleRetry(params: {
    campaignId: string;
    leadId?: string | null;
    campaignLeadId?: string | null;
    callId?: string | null;
    outcome: string;
    qualificationOutcome?: string | null;
  }): Promise<{ state: string; attemptCount: number; maxAttempts: number; nextAttemptAt: string | null }> {
    const nowIso = new Date().toISOString();
    const campaign = await this.getById(params.campaignId).catch(() => null);
    const maxAttempts = Number((campaign as any)?.max_attempts_per_lead ?? 3);
    const retryDelayMinutes = Number((campaign as any)?.retry_delay_minutes ?? 60);

    let enrollmentRow: any = null;
    try {
      if (params.campaignLeadId) {
        const { data } = await this.supabase
          .from('campaign_enrollments')
          .select('*')
          .eq('id', params.campaignLeadId)
          .maybeSingle();
        enrollmentRow = data;
      }
      if (!enrollmentRow && params.leadId) {
        const { data } = await this.supabase
          .from('campaign_enrollments')
          .select('*')
          .eq('campaign_id', params.campaignId)
          .eq('lead_id', params.leadId)
          .maybeSingle();
        enrollmentRow = data;
      }
    } catch {}

    let callCount = 0;
    if (params.leadId) {
      try {
        const { count } = await this.supabase
          .from('call_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', params.campaignId)
          .eq('lead_id', params.leadId);
        callCount = count ?? 0;
      } catch {}
    }

    const prevAttempts = Number(enrollmentRow?.attempt_count ?? 0);
    const newAttemptCount = Math.max(prevAttempts + 1, callCount || 1);
    const effectiveMax = Number(enrollmentRow?.max_attempts ?? maxAttempts);

    const normalizedOutcome = params.outcome.toLowerCase();
    const isRetryable = normalizedOutcome === 'no_answer' || normalizedOutcome === 'busy';
    const shouldRetry = isRetryable && newAttemptCount < effectiveMax;
    const nextAttemptAt = shouldRetry
      ? new Date(Date.now() + retryDelayMinutes * 60 * 1000).toISOString()
      : null;
    const nextState = shouldRetry ? 'queued' : 'completed';

    if (enrollmentRow?.id) {
      try {
        await this.supabase
          .from('campaign_enrollments')
          .update({
            state: nextState,
            attempt_count: newAttemptCount,
            max_attempts: effectiveMax,
            outcome: normalizedOutcome,
            qualification_outcome: params.qualificationOutcome ?? params.outcome.toUpperCase(),
            last_call_id: params.callId ?? enrollmentRow.last_call_id ?? null,
            last_attempt_at: nowIso,
            next_attempt_at: nextAttemptAt,
            claimed_by: null,
            claimed_at: null,
            updated_at: nowIso,
          } as any)
          .eq('id', enrollmentRow.id);
      } catch {}
    }

    return {
      state: nextState,
      attemptCount: newAttemptCount,
      maxAttempts: effectiveMax,
      nextAttemptAt,
    };
  }

  async completeLeadByContext(params: {
    campaignId: string;
    leadId?: string | null;
    campaignLeadId?: string | null;
    callId?: string | null;
    outcome: string;
    qualificationOutcome?: string | null;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    let enrollmentRow: any = null;
    try {
      if (params.campaignLeadId) {
        const { data } = await this.supabase
          .from('campaign_enrollments')
          .select('*')
          .eq('id', params.campaignLeadId)
          .maybeSingle();
        enrollmentRow = data;
      }
      if (!enrollmentRow && params.leadId) {
        const { data } = await this.supabase
          .from('campaign_enrollments')
          .select('*')
          .eq('campaign_id', params.campaignId)
          .eq('lead_id', params.leadId)
          .maybeSingle();
        enrollmentRow = data;
      }
    } catch {}

    let callCount = 0;
    if (params.leadId) {
      try {
        const { count } = await this.supabase
          .from('call_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', params.campaignId)
          .eq('lead_id', params.leadId);
        callCount = count ?? 0;
      } catch {}
    }

    if (enrollmentRow?.id) {
      const attemptCount = Math.max(Number(enrollmentRow.attempt_count ?? 0) + 1, callCount || 1);
      try {
        await this.supabase
          .from('campaign_enrollments')
          .update({
            state: 'completed',
            attempt_count: attemptCount,
            outcome: params.outcome.toLowerCase(),
            qualification_outcome: params.qualificationOutcome ?? params.outcome.toUpperCase(),
            last_call_id: params.callId ?? enrollmentRow.last_call_id ?? null,
            last_attempt_at: nowIso,
            next_attempt_at: null,
            claimed_by: null,
            claimed_at: null,
            updated_at: nowIso,
          } as any)
          .eq('id', enrollmentRow.id);
      } catch {}
    }
  }

  async releaseClaim(campaignLeadId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    if (isMockDevMode()) {
      const store = getDevStore();
      const row = store.campaignLeads.find((cl) => cl.id === campaignLeadId) as any;
      if (row && row.state === 'calling') {
        row.state = 'queued';
      }
      return;
    }

    try {
      await this.supabase
        .from('campaign_enrollments')
        .update({
          state: 'queued',
          claimed_by: null,
          claimed_at: null,
          updated_at: nowIso,
        } as any)
        .eq('id', campaignLeadId);
    } catch {}
  }

  async completeLead(campaignLeadId: string, outcome: string): Promise<void> {
    const nowIso = new Date().toISOString();
    if (isMockDevMode()) {
      const store = getDevStore();
      const row = store.campaignLeads.find((cl) => cl.id === campaignLeadId) as any;
      if (row) {
        row.state = 'completed';
        row.outcome = outcome;
        row.next_attempt_at = null;
      }
      return;
    }

    try {
      const { data: existing } = await this.supabase
        .from('campaign_enrollments')
        .select('attempt_count')
        .eq('id', campaignLeadId)
        .maybeSingle();

      const attempts = Math.max(1, Number((existing as any)?.attempt_count ?? 0) + 1);
      await this.supabase
        .from('campaign_enrollments')
        .update({
          state: 'completed',
          attempt_count: attempts,
          outcome,
          next_attempt_at: null,
          claimed_by: null,
          claimed_at: null,
          updated_at: nowIso,
        } as any)
        .eq('id', campaignLeadId);
    } catch {}
  }
}
