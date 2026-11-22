import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, WebhookStatusDb, CallStatusDb } from '@/lib/supabase/types';

export type CallRow = Database['public']['Tables']['call_sessions']['Row'];
export type CallInsert = Database['public']['Tables']['call_sessions']['Insert'];
export type CallUpdate = Database['public']['Tables']['call_sessions']['Update'];

export type CallEventRow = Database['public']['Tables']['call_events']['Row'];
export type CallEventInsert = Database['public']['Tables']['call_events']['Insert'];

export type CallRecordingRow = Database['public']['Tables']['call_recordings']['Row'];
export type CallRecordingInsert = Database['public']['Tables']['call_recordings']['Insert'];

export type CallTranscriptRow = Database['public']['Tables']['call_transcripts']['Row'];
export type CallTranscriptInsert = Database['public']['Tables']['call_transcripts']['Insert'];

export type WebhookEventRow = Database['public']['Tables']['webhook_events']['Row'];
export type WebhookEventInsert = Database['public']['Tables']['webhook_events']['Insert'];

export interface ListCallsOptions {
  limit?: number;
  offset?: number;
  status?: string;
  leadId?: string;
  campaignId?: string;
}

export class CallsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  async create(input: CallInsert): Promise<CallRow> {
    const payload: CallInsert = {
      ...input,
      created_by: input.created_by ?? input.operator_id ?? null,
      agent_id: input.agent_id ?? input.ai_agent_id ?? null,
      retell_call_id: input.retell_call_id ?? input.provider_call_id ?? null,
    };
    const { data, error } = await this.supabase
      .from('call_sessions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as CallRow;
  }

  async getById(id: string, orgId?: string): Promise<CallRow | null> {
    let query = this.supabase.from('call_sessions').select('*').eq('id', id);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as CallRow | null) ?? null;
  }

  async getByProviderCallId(providerCallId: string): Promise<CallRow | null> {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .select('*')
      .or(`retell_call_id.eq.${providerCallId},provider_call_id.eq.${providerCallId}`)
      .maybeSingle();
    if (error) throw error;
    return (data as CallRow | null) ?? null;
  }

  async getByRetellCallId(retellCallId: string): Promise<CallRow | null> {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .select('*')
      .eq('retell_call_id', retellCallId)
      .maybeSingle();
    if (error) throw error;
    return (data as CallRow | null) ?? null;
  }

  async getActiveCallForLead(leadId: string, orgId: string): Promise<CallRow | null> {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .select('*')
      .eq('lead_id', leadId)
      .eq('organization_id', orgId)
      .in('status', ['queued', 'ringing', 'in_progress'])
      .maybeSingle();
    if (error) throw error;
    return (data as CallRow | null) ?? null;
  }

  async update(id: string, orgId?: string, input?: CallUpdate): Promise<CallRow> {
    const payload = input ?? {};
    let query = this.supabase
      .from('call_sessions')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data as CallRow;
  }

  async list(
    orgId: string,
    optionsOrLimit: ListCallsOptions | number = {}
  ): Promise<{ calls: CallRow[]; totalCount: number }> {
    const options: ListCallsOptions =
      typeof optionsOrLimit === 'number' ? { limit: optionsOrLimit } : optionsOrLimit;

    let query = this.supabase
      .from('call_sessions')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId);

    if (options.status) {
      query = query.eq('status', options.status as CallStatusDb);
    }
    if (options.leadId) {
      query = query.eq('lead_id', options.leadId);
    }
    if (options.campaignId) {
      query = query.eq('campaign_id', options.campaignId);
    }

    query = query.order('created_at', { ascending: false });

    const limit = options.limit ?? 25;
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      calls: (data as CallRow[]) ?? [],
      totalCount: count ?? 0,
    };
  }

  async logEvent(input: CallEventInsert): Promise<CallEventRow> {
    const { data, error } = await this.supabase
      .from('call_events')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as CallEventRow;
  }

  async getEvents(callId: string): Promise<CallEventRow[]> {
    const { data, error } = await this.supabase
      .from('call_events')
      .select('*')
      .eq('call_id', callId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as CallEventRow[]) ?? [];
  }

  async saveRecording(input: CallRecordingInsert): Promise<CallRecordingRow> {
    const callSessionId = input.call_session_id || input.call_id;
    let orgId = input.organization_id;
    if (!orgId) {
      const call = await this.getById(callSessionId);
      orgId = call?.organization_id;
    }

    const payload: CallRecordingInsert = {
      ...input,
      organization_id: orgId || undefined,
      call_session_id: callSessionId,
      call_id: callSessionId,
      storage_path: input.storage_path,
      external_url: input.external_url || input.storage_path,
    };

    const { data, error } = await this.supabase
      .from('call_recordings')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as CallRecordingRow;
  }

  async getRecordingByCallId(callId: string): Promise<CallRecordingRow | null> {
    const { data, error } = await this.supabase
      .from('call_recordings')
      .select('*')
      .or(`call_id.eq.${callId},call_session_id.eq.${callId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      // Fallback
      const { data: fallback } = await this.supabase
        .from('call_recordings')
        .select('*')
        .eq('call_session_id', callId)
        .limit(1)
        .maybeSingle();
      return (fallback as CallRecordingRow | null) ?? null;
    }
    return (data as CallRecordingRow | null) ?? null;
  }

  async saveTranscriptSegment(input: CallTranscriptInsert): Promise<CallTranscriptRow> {
    const callSessionId = input.call_session_id || input.call_id;
    let orgId = input.organization_id;
    if (!orgId) {
      const call = await this.getById(callSessionId);
      orgId = call?.organization_id;
    }

    const transcriptBody =
      input.body ||
      (input.speaker && input.text ? `${input.speaker}: ${input.text}` : input.text || '');

    const payload: CallTranscriptInsert = {
      ...input,
      organization_id: orgId || undefined,
      call_session_id: callSessionId,
      call_id: callSessionId,
      body: transcriptBody,
      text: input.text || transcriptBody,
      speaker: input.speaker || 'system',
      sequence_number: input.sequence_number ?? 0,
    };

    const { data, error } = await this.supabase
      .from('call_transcripts')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as CallTranscriptRow;
  }

  async getTranscriptsByCallId(callId: string): Promise<CallTranscriptRow[]> {
    const { data, error } = await this.supabase
      .from('call_transcripts')
      .select('*')
      .or(`call_id.eq.${callId},call_session_id.eq.${callId}`)
      .order('created_at', { ascending: true });
    if (error) {
      const { data: fallback } = await this.supabase
        .from('call_transcripts')
        .select('*')
        .eq('call_session_id', callId)
        .order('created_at', { ascending: true });
      return (fallback as CallTranscriptRow[]) ?? [];
    }
    return (data as CallTranscriptRow[]) ?? [];
  }

  async recordWebhookEvent(
    input: WebhookEventInsert
  ): Promise<{ isDuplicate: boolean; event: WebhookEventRow }> {
    const extId = input.external_id || input.external_event_id;
    const providerOrSource = input.source || input.provider || 'retell';

    // 1. Idempotency Check
    let existing: WebhookEventRow | null = null;
    if (extId) {
      const { data } = await this.supabase
        .from('webhook_events')
        .select('*')
        .or(`external_event_id.eq.${extId},external_id.eq.${extId}`)
        .maybeSingle();
      if (data) existing = data as unknown as WebhookEventRow;
    }

    if (existing) {
      return { isDuplicate: true, event: existing };
    }

    // 2. Insert event record
    const payload: WebhookEventInsert = {
      ...input,
      provider: providerOrSource,
      source: providerOrSource,
      external_id: extId,
      external_event_id: extId,
      received_at: input.received_at || new Date().toISOString(),
    };

    const { data: created, error: insertError } = await this.supabase
      .from('webhook_events')
      .insert(payload)
      .select()
      .single();

    if (insertError) throw insertError;
    return { isDuplicate: false, event: created as WebhookEventRow };
  }

  async updateWebhookEventStatus(
    id: string,
    status: WebhookStatusDb,
    error?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('webhook_events')
        .update({
          processing_status: status,
          error_message: error ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch {
      // Ignore if columns are not present on remote schema
    }
  }

  async assignWebhookOrganization(id: string, orgId: string): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_events')
      .update({
        organization_id: orgId,
      })
      .eq('id', id);
    if (error) throw error;
  }

  async recordOutcome(input: {
    call_session_id: string;
    organization_id: string;
    disposition: string;
    notes?: string;
    recorded_by?: string | null;
  }): Promise<void> {
    try {
      await this.supabase.from('call_outcomes').insert({
        call_session_id: input.call_session_id,
        organization_id: input.organization_id,
        disposition: input.disposition,
        notes: input.notes || '',
        recorded_by: input.recorded_by || null,
      });
    } catch {
      // Gracefully ignore if constraints differ
    }
  }
}
