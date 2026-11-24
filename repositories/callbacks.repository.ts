import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CallbackStatusDb, LeadPriorityDb } from '@/lib/supabase/types';

export type CallbackRow = Database['public']['Tables']['callbacks']['Row'];
export type CallbackInsert = Database['public']['Tables']['callbacks']['Insert'];
export type CallbackUpdate = Database['public']['Tables']['callbacks']['Update'];

export interface CallbackFilterOptions {
  status?: CallbackStatusDb;
  priority?: LeadPriorityDb;
  leadId?: string;
  campaignId?: string;
  limit?: number;
  offset?: number;
}

export class CallbacksRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async list(
    orgId: string,
    options: CallbackFilterOptions = {}
  ): Promise<{ callbacks: CallbackRow[]; totalCount: number }> {
    let query = this.supabase
      .from('callbacks')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId);

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.priority) {
      query = query.eq('priority', options.priority);
    }
    if (options.leadId) {
      query = query.eq('lead_id', options.leadId);
    }
    if (options.campaignId) {
      query = query.eq('campaign_id', options.campaignId);
    }

    query = query.order('scheduled_for', { ascending: true });

    const limit = options.limit ?? 25;
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      callbacks: (data as CallbackRow[]) ?? [],
      totalCount: count ?? 0,
    };
  }

  async getById(id: string, orgId?: string): Promise<CallbackRow | null> {
    let query = this.supabase.from('callbacks').select('*').eq('id', id);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as CallbackRow | null) ?? null;
  }

  async create(input: CallbackInsert): Promise<CallbackRow> {
    const payload = {
      ...input,
      scheduled_for: input.scheduled_for || (input as any).scheduled_at || new Date().toISOString(),
      timezone: input.timezone || 'UTC',
      status: input.status || 'pending',
      priority: input.priority || 'medium',
      notes: input.notes || '',
    };

    const { data, error } = await this.supabase
      .from('callbacks')
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as CallbackRow;
  }

  async updateStatus(
    id: string,
    orgId: string,
    status: CallbackStatusDb,
    notes?: string
  ): Promise<CallbackRow> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (notes !== undefined) updates.notes = notes;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('callbacks')
      .update(updates as any)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return data as CallbackRow;
  }

  async countPending(orgId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('callbacks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'pending');

    if (error) throw error;
    return count ?? 0;
  }
}
