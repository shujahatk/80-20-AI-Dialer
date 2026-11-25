import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type LeadNoteRow = Database['public']['Tables']['lead_notes']['Row'];
export type LeadNoteInsert = Database['public']['Tables']['lead_notes']['Insert'];
export type LeadNoteUpdate = Database['public']['Tables']['lead_notes']['Update'];

export interface HydratedLeadNote {
  id: string;
  lead_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar?: string | null;
}

export class LeadNotesRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listByLeadId(leadId: string): Promise<HydratedLeadNote[]> {
    const { data, error } = await this.supabase
      .from('lead_notes')
      .select('id, lead_id, author_id, content, created_at, updated_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }
    if (!data || data.length === 0) return [];

    const authorIds = Array.from(new Set(data.map((n) => n.author_id))).filter(Boolean);
    let authorMap: Record<string, { name: string; avatarUrl: string | null }> = {};

    if (authorIds.length > 0) {
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', authorIds);

      if (profiles) {
        authorMap = Object.fromEntries(
          profiles.map((p) => [
            p.id,
            { name: p.display_name || 'Operator', avatarUrl: null },
          ])
        );
      }
    }

    return data.map((note) => {
      const author = authorMap[note.author_id];
      return {
        ...note,
        author_name: author?.name ?? 'Operator',
        author_avatar: author?.avatarUrl ?? null,
      };
    });
  }

  async create(input: {
    lead_id: string;
    author_id: string;
    content: string;
  }): Promise<HydratedLeadNote> {
    const { data, error } = await this.supabase
      .from('lead_notes')
      .insert({
        lead_id: input.lead_id,
        author_id: input.author_id,
        content: input.content,
      })
      .select()
      .single();

    if (error) throw error;

    let authorName = 'Operator';
    let authorAvatar: string | null = null;

    if (input.author_id) {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', input.author_id)
        .maybeSingle();

      if (profile) {
        authorName = profile.display_name || 'Operator';
        authorAvatar = profile.avatar_url ?? null;
      }
    }

    return {
      ...data,
      author_name: authorName,
      author_avatar: authorAvatar,
    };
  }

  async delete(noteId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('lead_notes')
      .delete()
      .eq('id', noteId);
    if (error) throw error;
    return true;
  }
}

