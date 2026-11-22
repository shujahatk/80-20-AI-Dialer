import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type LeadTagRow = Database['public']['Tables']['lead_tags']['Row'];
export type LeadTagInsert = Database['public']['Tables']['lead_tags']['Insert'];
export type LeadTagUpdate = Database['public']['Tables']['lead_tags']['Update'];

export class LeadTagsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getTagsForLead(leadId: string): Promise<LeadTagRow[]> {
    const { data: assignments, error: assignError } = await this.supabase
      .from('lead_tag_assignments')
      .select('tag_id')
      .eq('lead_id', leadId);

    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) return [];

    const tagIds = assignments.map((a) => a.tag_id);
    const { data: tags, error: tagError } = await this.supabase
      .from('lead_tags')
      .select('*')
      .in('id', tagIds);

    if (tagError) throw tagError;
    return (tags as LeadTagRow[]) ?? [];
  }

  async getOrCreateTag(
    orgId: string,
    name: string,
    color: string = '#4cd7f6'
  ): Promise<LeadTagRow> {
    const trimmed = name.trim();
    const { data: existing, error: findError } = await this.supabase
      .from('lead_tags')
      .select('*')
      .eq('organization_id', orgId)
      .ilike('name', trimmed)
      .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing as LeadTagRow;

    const { data: created, error: insertError } = await this.supabase
      .from('lead_tags')
      .insert({
        organization_id: orgId,
        name: trimmed,
        color,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return created as LeadTagRow;
  }

  async assignTag(leadId: string, tagId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lead_tag_assignments')
      .upsert({
        lead_id: leadId,
        tag_id: tagId,
      });
    if (error) throw error;
  }

  async removeTag(leadId: string, tagId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lead_tag_assignments')
      .delete()
      .eq('lead_id', leadId)
      .eq('tag_id', tagId);
    if (error) throw error;
  }

  async bulkAssignTag(leadIds: string[], tagId: string): Promise<number> {
    if (leadIds.length === 0) return 0;
    const assignments = leadIds.map((leadId) => ({
      lead_id: leadId,
      tag_id: tagId,
    }));
    const { error } = await this.supabase
      .from('lead_tag_assignments')
      .upsert(assignments);
    if (error) throw error;
    return leadIds.length;
  }
}

