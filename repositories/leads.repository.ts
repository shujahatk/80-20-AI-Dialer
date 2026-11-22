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

export class LeadsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

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
      query = query.in('status', [options.status as LeadStatusDb, upper as LeadStatusDb, lower as LeadStatusDb]);
    }

    if (options.priority && options.priority !== 'All') {
      query = query.eq('priority', options.priority as LeadPriorityDb);
    }

    if (typeof options.isDnc === 'boolean') {
      query = query.eq('do_not_call', options.isDnc);
    }

    if (options.source && options.source !== 'All') {
      query = query.eq('source', options.source);
    }

    if (options.country && options.country !== 'All') {
      query = query.eq('country', options.country);
    }

    if (options.region && options.region !== 'All') {
      query = query.eq('region', options.region);
    }

    query = query.order('created_at', { ascending: false });

    const limit = options.limit ?? 25;
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      leads: (data as LeadRow[]) ?? [],
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
    return (data as LeadRow | null) ?? null;
  }

  async create(input: LeadInsert): Promise<LeadRow> {
    const payload = {
      ...input,
      name: input.name ?? input.full_name ?? [input.first_name, input.last_name].filter(Boolean).join(' ') ?? 'Unnamed lead',
      company: input.company ?? input.company_name ?? '',
      title: input.title ?? input.job_title ?? '',
      do_not_call: input.do_not_call ?? input.is_dnc ?? false,
      temperature: input.temperature ?? 'COLD',
      status: (input.status ? String(input.status).toUpperCase() : 'NEW') as LeadStatusDb,
    };
    const { data, error } = await this.supabase
      .from('leads')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as LeadRow;
  }

  async update(id: string, orgId: string, input: LeadUpdate): Promise<LeadRow> {
    const payload: LeadUpdate = {
      ...input,
      updated_at: new Date().toISOString(),
    };
    if (input.full_name && !input.name) payload.name = input.full_name;
    if (input.company_name && !input.company) payload.company = input.company_name;
    if (input.job_title && !input.title) payload.title = input.job_title;
    if (typeof input.is_dnc === 'boolean' && input.do_not_call === undefined) payload.do_not_call = input.is_dnc;
    if (input.is_archived && !input.deleted_at) payload.deleted_at = new Date().toISOString();
    if (input.status) payload.status = String(input.status).toUpperCase() as LeadStatusDb;

    const { data, error } = await this.supabase
      .from('leads')
      .update(payload)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();
    if (error) throw error;
    return data as LeadRow;
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
    status: LeadStatusDb
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const { error } = await this.supabase
      .from('leads')
      .update({
        status,
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
    return Array.from(unique.values());
  }

  async createBatch(chunk: LeadInsert[]): Promise<LeadRow[]> {
    if (chunk.length === 0) return [];
    const { data, error } = await this.supabase
      .from('leads')
      .insert(chunk)
      .select();
    if (error) throw error;
    return (data as LeadRow[]) ?? [];
  }
}
