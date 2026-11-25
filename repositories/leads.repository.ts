import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadStatusDb, LeadPriorityDb } from '@/lib/supabase/types';

export type LeadRow = Database['public']['Tables']['leads']['Row'];
export type LeadInsert = Database['public']['Tables']['leads']['Insert'];
export type LeadUpdate = Database['public']['Tables']['leads']['Update'];

export interface LeadMetricsSummary {
  totalLeads: number;
  contacted: number;
  qualified: number;
  dncRestricted: number;
}

export interface LeadFilterOptions {
  search?: string;
  status?: string;
  priority?: string;
  isDnc?: boolean;
  isArchived?: boolean;
  source?: string;
  country?: string;
  region?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

/**
 * Projects an input payload to only columns physically existing on the remote 'leads' table:
 * ['id', 'organization_id', 'assigned_to', 'created_by', 'name', 'company',
 *  'title', 'email', 'phone', 'city', 'status', 'temperature', 'score',
 *  'deal_value', 'product', 'next_action', 'notes', 'deleted_at', 'created_at',
 *  'updated_at', 'do_not_call', 'consent_at']
 */
export function sanitizeRemoteLeadPayload(input: Record<string, any>): Record<string, any> {
  const computedName =
    (input.name && String(input.name).trim()) ||
    (input.full_name && String(input.full_name).trim()) ||
    [input.first_name, input.last_name].filter(Boolean).join(' ').trim() ||
    'Unnamed lead';
  const company = input.company !== undefined ? input.company : (input.company_name ?? '');
  const title = input.title !== undefined ? input.title : (input.job_title ?? '');
  const phone = input.phone ?? input.phone_e164 ?? '';
  const do_not_call =
    input.do_not_call !== undefined
      ? Boolean(input.do_not_call)
      : input.is_dnc !== undefined
        ? Boolean(input.is_dnc)
        : false;

  const rawStatus = input.status ? String(input.status).toUpperCase() : 'NEW';
  const statusMap: Record<string, string> = {
    NEW: 'NEW',
    CONTACTED: 'CONTACTED',
    ENGAGED: 'ENGAGED',
    TECHNICAL_EVALUATION: 'TECHNICAL_EVALUATION',
    COMMERCIAL_DISCUSSION: 'COMMERCIAL_DISCUSSION',
    QUALIFIED: 'COMMERCIAL_DISCUSSION',
    CONVERTED: 'COMMERCIAL_DISCUSSION',
    UNQUALIFIED: 'CONTACTED',
    DNC: 'CONTACTED',
    IN_PROGRESS: 'CONTACTED',
    QUEUED: 'NEW',
    CONFIRMED: 'COMMERCIAL_DISCUSSION',
    INTERESTED: 'ENGAGED',
    FOLLOW_UP: 'ENGAGED',
    CALLBACK: 'CONTACTED',
    NOT_INTERESTED: 'CONTACTED',
  };
  const status = statusMap[rawStatus] || 'NEW';

  const clean: Record<string, any> = {};
  if (input.id) clean.id = input.id;
  if (input.organization_id) clean.organization_id = input.organization_id;
  clean.name = computedName;
  if (company !== undefined) clean.company = company;
  if (title !== undefined) clean.title = title;
  if (phone) clean.phone = phone;
  if (input.email !== undefined) clean.email = input.email ? String(input.email).toLowerCase().trim() : null;
  if (input.city !== undefined) clean.city = input.city;
  if (input.assigned_to !== undefined) clean.assigned_to = input.assigned_to;
  if (input.created_by !== undefined) clean.created_by = input.created_by;
  if (input.notes !== undefined) clean.notes = input.notes;
  if (input.temperature !== undefined) clean.temperature = input.temperature;
  if (input.score !== undefined) clean.score = input.score;
  if (input.deal_value !== undefined) clean.deal_value = input.deal_value;
  if (input.product !== undefined) clean.product = input.product;
  if (input.next_action !== undefined) clean.next_action = input.next_action;
  if (input.deleted_at !== undefined) clean.deleted_at = input.deleted_at;
  clean.status = status;
  clean.do_not_call = do_not_call;
  return clean;
}

export class LeadsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  /**
   * Enriches a raw database lead row with backward-compatible domain aliases
   */
  public enrichLeadRow(row: any): LeadRow {
    if (!row) return row;
    const nameStr = row.name || row.full_name || 'Unnamed lead';
    const nameParts = String(nameStr).trim().split(/\s+/);
    const firstName = row.first_name || nameParts[0] || '';
    const lastName = row.last_name || nameParts.slice(1).join(' ') || '';

    // Map uppercase remote enum status to lowercase domain status for UI
    let domainStatus = 'new';
    if (row.do_not_call) {
      domainStatus = 'dnc';
    } else if (row.status === 'COMMERCIAL_DISCUSSION' || row.status === 'TECHNICAL_EVALUATION') {
      domainStatus = 'qualified';
    } else if (row.status === 'ENGAGED') {
      domainStatus = 'engaged';
    } else if (row.status === 'CONTACTED') {
      domainStatus = 'contacted';
    } else {
      domainStatus = 'new';
    }

    return {
      ...row,
      status: domainStatus,
      first_name: firstName,
      last_name: lastName,
      full_name: nameStr,
      company_name: row.company_name || row.company || '',
      job_title: row.job_title || row.title || '',
      phone_e164: row.phone_e164 || row.phone || '',
      is_dnc: row.is_dnc ?? row.do_not_call ?? false,
      is_archived: row.is_archived ?? Boolean(row.deleted_at),
      country: row.country || 'US',
      region: row.region || '',
      city: row.city || '',
      timezone: row.timezone || 'America/Chicago',
      source: row.source || 'manual',
      priority: row.priority || 'medium',
      custom_fields: row.custom_fields || {},
    } as LeadRow;
  }

  async list(
    orgId: string,
    options: LeadFilterOptions = {}
  ): Promise<{ leads: LeadRow[]; totalCount: number }> {
    let query = this.supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId);

    if (options.isArchived) {
      query = query.not('deleted_at', 'is', null);
    } else {
      query = query.is('deleted_at', null);
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      query = query.or(
        `name.ilike.${term},company.ilike.${term},phone.ilike.${term},email.ilike.${term}`
      );
    }

    if (options.status && options.status !== 'All') {
      const upper = options.status.toUpperCase();
      const lower = options.status.toLowerCase();
      const allowed: string[] = [options.status, upper, lower];
      if (lower === 'qualified') {
        allowed.push('ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION');
      } else if (lower === 'new') {
        allowed.push('NEW', 'QUEUED', 'queued');
      } else if (lower === 'contacted') {
        allowed.push('CONTACTED', 'IN_PROGRESS', 'in_progress');
      }
      query = query.in('status', Array.from(new Set(allowed)) as LeadStatusDb[]);
    }

    if (typeof options.isDnc === 'boolean') {
      if (options.isDnc) {
        query = query.eq('do_not_call', true);
      } else {
        query = query.or('do_not_call.eq.false,do_not_call.is.null');
      }
    }

    query = query.order('created_at', { ascending: false });

    const limit = options.limit ?? 25;
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      leads: ((data as any[]) ?? []).map((r) => this.enrichLeadRow(r)),
      totalCount: count ?? 0,
    };
  }

  async getMetrics(orgId: string): Promise<LeadMetricsSummary> {
    const base = this.supabase
      .from('leads')
      .select('status, do_not_call', { count: 'exact' })
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    const [totalRes, contactedRes, qualifiedRes, dncRes] = await Promise.all([
      base,
      this.supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .in('status', ['CONTACTED', 'ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION']),
      this.supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .in('status', ['ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION']),
      this.supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .eq('do_not_call', true),
    ]);

    return {
      totalLeads: totalRes.count ?? 0,
      contacted: contactedRes.count ?? 0,
      qualified: qualifiedRes.count ?? 0,
      dncRestricted: dncRes.count ?? 0,
    };
  }

  async getById(id: string, orgId?: string): Promise<LeadRow | null> {
    let query = this.supabase.from('leads').select('*').eq('id', id);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? this.enrichLeadRow(data) : null;
  }

  async create(input: LeadInsert): Promise<LeadRow> {
    const payload = sanitizeRemoteLeadPayload(input);
    const { data, error } = await this.supabase
      .from('leads')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return this.enrichLeadRow(data);
  }

  async update(id: string, orgId: string, input: LeadUpdate): Promise<LeadRow> {
    const payload = sanitizeRemoteLeadPayload({
      ...input,
      updated_at: new Date().toISOString(),
    });
    delete payload.id;
    delete payload.organization_id;

    const { data, error } = await this.supabase
      .from('leads')
      .update(payload as any)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();
    if (error) throw error;
    return this.enrichLeadRow(data);
  }

  async markDnc(id: string, orgId: string, reason?: string | null): Promise<LeadRow> {
    return this.update(id, orgId, {
      do_not_call: true,
      notes: reason ? `[DNC]: ${reason}` : undefined,
    });
  }

  async removeDnc(id: string, orgId: string): Promise<LeadRow> {
    return this.update(id, orgId, {
      do_not_call: false,
    });
  }

  async archive(id: string, orgId: string): Promise<LeadRow> {
    return this.update(id, orgId, {
      deleted_at: new Date().toISOString(),
    });
  }

  async bulkSetDnc(
    ids: string[],
    orgId: string,
    isDncOrReason: boolean | string,
    _reason?: string | null
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const isDnc = typeof isDncOrReason === 'boolean' ? isDncOrReason : true;

    const { error } = await this.supabase
      .from('leads')
      .update({
        do_not_call: isDnc,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('organization_id', orgId);
    if (error) throw error;
    return ids.length;
  }

  async bulkUpdateStatus(
    ids: string[],
    orgId: string,
    status: LeadStatusDb | string
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const rawStatus = String(status).toUpperCase();
    const statusMap: Record<string, string> = {
      NEW: 'NEW',
      CONTACTED: 'CONTACTED',
      ENGAGED: 'ENGAGED',
      TECHNICAL_EVALUATION: 'TECHNICAL_EVALUATION',
      COMMERCIAL_DISCUSSION: 'COMMERCIAL_DISCUSSION',
      QUALIFIED: 'COMMERCIAL_DISCUSSION',
      CONVERTED: 'COMMERCIAL_DISCUSSION',
      UNQUALIFIED: 'CONTACTED',
      DNC: 'CONTACTED',
    };
    const dbStatus = statusMap[rawStatus] || 'NEW';
    const { error } = await this.supabase
      .from('leads')
      .update({
        status: dbStatus as any,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('organization_id', orgId);
    if (error) throw error;
    return ids.length;
  }

  async bulkArchive(ids: string[], orgId: string): Promise<number> {
    if (ids.length === 0) return 0;
    const { error } = await this.supabase
      .from('leads')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('organization_id', orgId);
    if (error) throw error;
    return ids.length;
  }

  async findDuplicates(
    phones: string[],
    emails: string[],
    orgId: string
  ): Promise<LeadRow[]> {
    if (phones.length === 0 && emails.length === 0) return [];

    const cleanEmails = Array.from(new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean)));
    const cleanPhones = Array.from(new Set(phones.map((p) => p.trim()).filter(Boolean)));
    const matches: LeadRow[] = [];

    // Query in safe chunks to prevent URL overflow
    if (cleanEmails.length > 0) {
      for (let i = 0; i < cleanEmails.length; i += 50) {
        const chunk = cleanEmails.slice(i, i + 50);
        const { data, error } = await this.supabase
          .from('leads')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .in('email', chunk);
        if (!error && data) {
          matches.push(...(data as LeadRow[]));
        }
      }
    }

    if (cleanPhones.length > 0) {
      for (let i = 0; i < cleanPhones.length; i += 50) {
        const chunk = cleanPhones.slice(i, i + 50);
        const { data, error } = await this.supabase
          .from('leads')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .in('phone', chunk);
        if (!error && data) {
          matches.push(...(data as LeadRow[]));
        }
      }
    }

    const unique = new Map<string, LeadRow>();
    for (const m of matches) {
      unique.set(m.id, m);
    }
    return Array.from(unique.values()).map((r) => this.enrichLeadRow(r));
  }

  async createBatch(chunk: LeadInsert[]): Promise<LeadRow[]> {
    if (chunk.length === 0) return [];
    const payloads = chunk.map((item) => sanitizeRemoteLeadPayload(item));
    const { data, error } = await this.supabase
      .from('leads')
      .insert(payloads as any)
      .select();
    if (error) throw error;
    return ((data as any[]) ?? []).map((r) => this.enrichLeadRow(r));
  }
}
