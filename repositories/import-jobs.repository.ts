import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type ImportJobRow = Database['public']['Tables']['lead_import_jobs']['Row'];
export type ImportJobInsert = Database['public']['Tables']['lead_import_jobs']['Insert'];
export type ImportJobUpdate = Database['public']['Tables']['lead_import_jobs']['Update'];

export class ImportJobsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  async create(input: ImportJobInsert): Promise<ImportJobRow> {
    const { data, error } = await this.supabase
      .from('lead_import_jobs')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data as ImportJobRow;
  }

  async update(
    id: string,
    orgId: string,
    input: ImportJobUpdate
  ): Promise<ImportJobRow> {
    const { data, error } = await this.supabase
      .from('lead_import_jobs')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return data as ImportJobRow;
  }

  async getById(id: string, orgId?: string): Promise<ImportJobRow | null> {
    let query = this.supabase.from('lead_import_jobs').select('*').eq('id', id);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as ImportJobRow | null) ?? null;
  }
}

