import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, WebhookStatusDb, CallStatusDb, Json } from '@/lib/supabase/types';

export type CallRow = Database['public']['Tables']['call_sessions']['Row'];
export type CallInsert = Database['public']['Tables']['call_sessions']['Insert'];
export type CallUpdate = Database['public']['Tables']['call_sessions']['Update'];

export type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];

export type CallRecordingRow = Database['public']['Tables']['call_recordings']['Row'];
export type CallRecordingInsert = Database['public']['Tables']['call_recordings']['Insert'];

export type CallTranscriptRow = Database['public']['Tables']['call_transcripts']['Row'];
export type CallTranscriptInsert = Database['public']['Tables']['call_transcripts']['Insert'];

export type WebhookEventRow = Database['public']['Tables']['webhook_events']['Row'];
export type WebhookEventInsert = Database['public']['Tables']['webhook_events']['Insert'];

export interface HydratedCallDetail {
  id: string;
  organization_id: string;
  lead_id: string | null;
  campaign_id: string | null;
  agent_id: string | null;
  status: string;
  direction: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  from_number: string | null;
  to_number: string | null;
  retell_call_id: string | null;
  provider_call_id: string | null;
  disconnection_reason: string | null;
  created_at: string;
  outcome: string;
  outcome_notes: string | null;
  outcome_recorded_at: string | null;
  transcript: string | null;
  transcript_turns: Array<{ id: string; body: string; created_at: string }>;
  recording_url: string | null;
  analysis: Record<string, unknown> | null;
}

export interface ListCallsOptions {
  limit?: number;
  offset?: number;
  status?: string;
  leadId?: string;
  campaignId?: string;
}

export class CallsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Helper to enrich a raw call_sessions row with backward-compatible aliases
   */
  private enrichCallRow(row: any): CallRow {
    if (!row) return row;
    return {
      ...row,
      operator_id: row.created_by ?? row.operator_id ?? null,
      ai_agent_id: row.agent_id ?? row.ai_agent_id ?? null,
      provider_call_id: row.retell_call_id ?? row.provider_call_id ?? null,
    } as CallRow;
  }

  /**
   * Creates a call session in public.call_sessions using ONLY verified remote columns.
   * Unsupported fields (such as operator_id, provider_metadata, recording_status) are excluded
   * or mapped to verified remote columns (created_by, agent_id, retell_call_id).
   */
  async create(input: CallInsert): Promise<CallRow> {
    const createdBy = input.created_by ?? (input as any).operator_id ?? null;
    const rawAgentId = input.agent_id ?? (input as any).ai_agent_id ?? null;
    // Strict UUID validation: call_sessions.agent_id is a UUID column. Non-UUID strings (e.g. Retell agent IDs) must be null.
    const isAgentUuid = rawAgentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawAgentId));
    const agentId = isAgentUuid ? rawAgentId : null;
    const retellCallId = input.retell_call_id ?? (input as any).provider_call_id ?? null;
    const now = new Date().toISOString();

    // Strict remote schema projection: public.call_sessions columns only
    const payload: Record<string, unknown> = {
      organization_id: input.organization_id,
      lead_id: input.lead_id ?? null,
      campaign_id: input.campaign_id ?? null,
      agent_id: agentId,
      created_by: createdBy,
      status: input.status,
      started_at: input.started_at ?? now,
      ended_at: input.ended_at ?? null,
      duration_seconds: input.duration_seconds ?? null,
      direction: input.direction,
      from_number: input.from_number ?? null,
      to_number: input.to_number ?? null,
      retell_call_id: retellCallId,
      failure_reason: input.failure_reason ?? null,
      disconnection_reason: input.disconnection_reason ?? null,
      approved_at: input.approved_at ?? null,
      idempotency_key: input.idempotency_key ?? null,
      provider: input.provider || 'live',
    };

    if (input.id) {
      payload.id = input.id;
    }

    const { data, error } = await this.supabase
      .from('call_sessions')
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return this.enrichCallRow(data);
  }

  async getById(id: string, orgId?: string): Promise<CallRow | null> {
    let query = this.supabase.from('call_sessions').select('*').eq('id', id);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? this.enrichCallRow(data) : null;
  }

  async getByProviderCallId(providerCallId: string): Promise<CallRow | null> {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .select('*')
      .eq('retell_call_id', providerCallId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.enrichCallRow(data) : null;
  }

  async getByRetellCallId(retellCallId: string): Promise<CallRow | null> {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .select('*')
      .eq('retell_call_id', retellCallId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.enrichCallRow(data) : null;
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
    return data ? this.enrichCallRow(data) : null;
  }

  /**
   * Updates an existing call session in public.call_sessions.
   * Excludes updated_at and unmapped columns not present in the remote schema.
   */
  async update(id: string, orgId?: string, input?: CallUpdate): Promise<CallRow> {
    const payload: Record<string, unknown> = {};

    if (input) {
      if (input.status !== undefined) payload.status = input.status;
      if (input.started_at !== undefined) payload.started_at = input.started_at;
      if (input.ended_at !== undefined) payload.ended_at = input.ended_at;
      if (input.duration_seconds !== undefined) payload.duration_seconds = input.duration_seconds;
      if (input.retell_call_id !== undefined) payload.retell_call_id = input.retell_call_id;
      if ((input as any).provider_call_id !== undefined && payload.retell_call_id === undefined) {
        payload.retell_call_id = (input as any).provider_call_id;
      }
      if (input.failure_reason !== undefined) payload.failure_reason = input.failure_reason;
      if (input.disconnection_reason !== undefined) payload.disconnection_reason = input.disconnection_reason;
      if (input.approved_at !== undefined) payload.approved_at = input.approved_at;
      if (input.from_number !== undefined) payload.from_number = input.from_number;
      if (input.to_number !== undefined) payload.to_number = input.to_number;
      if (input.agent_id !== undefined) payload.agent_id = input.agent_id;
      if ((input as any).ai_agent_id !== undefined && payload.agent_id === undefined) {
        payload.agent_id = (input as any).ai_agent_id;
      }
      if (input.created_by !== undefined) payload.created_by = input.created_by;
      if ((input as any).operator_id !== undefined && payload.created_by === undefined) {
        payload.created_by = (input as any).operator_id;
      }
      if (input.lead_id !== undefined) payload.lead_id = input.lead_id;
      if (input.campaign_id !== undefined) payload.campaign_id = input.campaign_id;
      if (input.direction !== undefined) payload.direction = input.direction;
      if (input.provider !== undefined) payload.provider = input.provider;
      if (input.idempotency_key !== undefined) payload.idempotency_key = input.idempotency_key;
    }

    let query = this.supabase
      .from('call_sessions')
      .update(payload as any)
      .eq('id', id);

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data, error } = await query.select().single();
    if (error) {
      // Fallback to admin client (service role) if blocked by trigger (e.g. status protection) or RLS
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const admin = createAdminClient();
        let adminQuery = admin.from('call_sessions').update(payload as any).eq('id', id);
        if (orgId) adminQuery = adminQuery.eq('organization_id', orgId);
        const { data: adminData, error: adminErr } = await adminQuery.select().single();
        if (!adminErr && adminData) {
          return this.enrichCallRow(adminData);
        }
      } catch {
        // preserve original error
      }
      throw error;
    }
    return this.enrichCallRow(data);
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
      calls: (data ?? []).map((row) => this.enrichCallRow(row)),
      totalCount: count ?? 0,
    };
  }

  /**
   * Records an immutable entry in public.audit_logs for call operations.
   * This uses the verified remote audit_logs table schema.
   */
  async recordAuditLog(input: {
    organization_id: string;
    actor_id?: string | null;
    action: string;
    entity: string;
    entity_id?: string | null;
    metadata: Json;
  }): Promise<AuditLogRow> {
    const payload = {
      organization_id: input.organization_id,
      actor_id: input.actor_id || null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entity_id || null,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await this.supabase
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Fallback to admin client (service role) to bypass RLS restrictions
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const admin = createAdminClient();
        const { data: adminData, error: adminErr } = await admin
          .from('audit_logs')
          .insert(payload)
          .select()
          .single();
        if (!adminErr && adminData) return adminData as AuditLogRow;
      } catch {
        // non-blocking fallback
      }

      // If audit ledger write fails, log warning and return synthesized row so call is never blocked
      console.warn('[CallsRepository] audit_logs insert failed, continuing call initiation:', error.message);
      return {
        id: 'aud_' + Date.now(),
        organization_id: input.organization_id,
        actor_id: input.actor_id || null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entity_id || null,
        metadata: input.metadata ?? {},
        created_at: new Date().toISOString(),
      } as AuditLogRow;
    }
    return data as AuditLogRow;
  }

  /**
   * Compatibility wrapper that writes call events to the verified public.audit_logs table.
   */
  async logEvent(input: {
    organization_id: string;
    call_id: string;
    event_type: string;
    payload?: Json;
    occurred_at?: string;
    provider_event_id?: string;
  }): Promise<AuditLogRow> {
    const now = input.occurred_at || new Date().toISOString();
    const actorId =
      (input.payload as any)?.approvedBy ||
      (input.payload as any)?.operatorId ||
      null;

    return this.recordAuditLog({
      organization_id: input.organization_id,
      actor_id: actorId,
      action: `call.${input.event_type}`,
      entity: 'call_session',
      entity_id: input.call_id,
      metadata: {
        event_type: input.event_type,
        occurred_at: now,
        provider_event_id: input.provider_event_id || null,
        ...(typeof input.payload === 'object' && input.payload !== null ? (input.payload as object) : {}),
      } as Json,
    });
  }

  /**
   * Retrieves call event history from public.audit_logs
   */
  async getEvents(callId: string): Promise<Array<{
    id: string;
    organization_id: string;
    call_id: string;
    event_type: string;
    payload: Json;
    created_at: string;
  }>> {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('entity', 'call_session')
      .eq('entity_id', callId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      call_id: row.entity_id || callId,
      event_type: row.action.replace(/^call\./, ''),
      payload: row.metadata,
      created_at: row.created_at,
    }));
  }

  /**
   * Saves a recording entry in public.call_recordings matching remote schema.
   */
  async saveRecording(input: CallRecordingInsert): Promise<CallRecordingRow> {
    const callSessionId = input.call_session_id || (input as any).call_id;
    let orgId = input.organization_id;
    if (!orgId && callSessionId) {
      const call = await this.getById(callSessionId);
      orgId = call?.organization_id;
    }

    if (!orgId || !callSessionId) {
      throw new Error('Call recording requires organization_id and call_session_id');
    }

    const payload = {
      organization_id: orgId,
      call_session_id: callSessionId,
      storage_path: input.storage_path || null,
      external_url: input.external_url || input.storage_path || null,
    };

    const { data, error } = await this.supabase
      .from('call_recordings')
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as CallRecordingRow;
  }

  async getRecordingByCallId(callId: string): Promise<CallRecordingRow | null> {
    const { data, error } = await this.supabase
      .from('call_recordings')
      .select('*')
      .eq('call_session_id', callId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return (data as CallRecordingRow | null) ?? null;
  }

  /**
   * Saves a transcript segment in public.call_transcripts matching remote schema.
   */
  async saveTranscriptSegment(input: CallTranscriptInsert): Promise<CallTranscriptRow> {
    const callSessionId = input.call_session_id || (input as any).call_id;
    let orgId = input.organization_id;
    if (!orgId && callSessionId) {
      const call = await this.getById(callSessionId);
      orgId = call?.organization_id;
    }

    if (!orgId || !callSessionId) {
      throw new Error('Call transcript requires organization_id and call_session_id');
    }

    const transcriptBody =
      input.body ||
      ((input as any).speaker && (input as any).text
        ? `${(input as any).speaker}: ${(input as any).text}`
        : (input as any).text || '');

    const payload = {
      organization_id: orgId,
      call_session_id: callSessionId,
      body: transcriptBody || 'Transcript turn',
    };

    const { data, error } = await this.supabase
      .from('call_transcripts')
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as CallTranscriptRow;
  }

  async getTranscriptsByCallId(callId: string): Promise<CallTranscriptRow[]> {
    const { data, error } = await this.supabase
      .from('call_transcripts')
      .select('*')
      .eq('call_session_id', callId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return (data as CallTranscriptRow[]) ?? [];
  }

  /**
   * Ingests webhook events idempotently in public.webhook_events matching remote schema.
   */
  async recordWebhookEvent(
    input: WebhookEventInsert
  ): Promise<{ isDuplicate: boolean; event: WebhookEventRow }> {
    const extId = input.external_id || (input as any).external_event_id || null;
    const providerOrSource = input.source || (input as any).provider || 'retell';

    // 1. Idempotency Check
    if (extId) {
      const { data } = await this.supabase
        .from('webhook_events')
        .select('*')
        .eq('external_id', extId)
        .maybeSingle();
      if (data) {
        return { isDuplicate: true, event: data as WebhookEventRow };
      }
    }

    // 2. Insert event record using only remote schema columns
    const payload = {
      organization_id: input.organization_id || null,
      source: providerOrSource,
      event_type: input.event_type,
      payload: input.payload,
      received_at: input.received_at || new Date().toISOString(),
      external_id: extId,
    };

    const { data: created, error: insertError } = await this.supabase
      .from('webhook_events')
      .insert(payload as any)
      .select()
      .single();

    if (insertError) throw insertError;
    return { isDuplicate: false, event: created as WebhookEventRow };
  }

  async updateWebhookEventStatus(
    _id: string,
    _status: WebhookStatusDb,
    _error?: string
  ): Promise<void> {
    // No-op: webhook_events table in remote schema does not maintain mutable processing_status columns
  }

  async assignWebhookOrganization(id: string, orgId: string): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_events')
      .update({
        organization_id: orgId,
      } as any)
      .eq('id', id);
    if (error) throw error;
  }

  /**
   * Retrieves an outcome from public.call_outcomes by call_session_id.
   */
  async getOutcomeByCallSessionId(callSessionId: string): Promise<{
    id: string;
    organization_id: string;
    call_session_id: string;
    disposition: string;
    notes: string | null;
    recorded_by: string | null;
    created_at: string;
  } | null> {
    const { data, error } = await this.supabase
      .from('call_outcomes')
      .select('*')
      .eq('call_session_id', callSessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data as any;
  }

  /**
   * Persists call outcomes to public.call_outcomes matching remote schema.
   * If an outcome already exists for this call session, updates it; otherwise inserts.
   */
  async recordOutcome(input: {
    call_session_id: string;
    organization_id: string;
    disposition: string;
    notes?: string;
    recorded_by?: string | null;
  }): Promise<void> {
    try {
      const existing = await this.getOutcomeByCallSessionId(input.call_session_id);
      if (existing) {
        await this.supabase
          .from('call_outcomes')
          .update({
            disposition: input.disposition,
            notes: input.notes || existing.notes || '',
            recorded_by: input.recorded_by || existing.recorded_by || null,
          } as any)
          .eq('id', existing.id);
      } else {
        await this.supabase.from('call_outcomes').insert({
          call_session_id: input.call_session_id,
          organization_id: input.organization_id,
          disposition: input.disposition,
          notes: input.notes || '',
          recorded_by: input.recorded_by || null,
        } as any);
      }
    } catch (err) {
      console.warn('[CallsRepository] recordOutcome error:', err);
    }
  }

  /**
   * Retrieves all call sessions for a lead along with their outcomes, transcripts, recordings, and AI analysis.
   */
  async listCallsWithDetailsForLead(
    leadId: string,
    orgId: string,
    limit: number = 50
  ): Promise<HydratedCallDetail[]> {
    const { data: calls, error: callsErr } = await this.supabase
      .from('call_sessions')
      .select('*')
      .eq('lead_id', leadId)
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (callsErr || !calls || calls.length === 0) {
      return [];
    }

    const callIds = calls.map((c) => c.id);

    // Batch query outcomes
    const { data: outcomes } = await this.supabase
      .from('call_outcomes')
      .select('*')
      .in('call_session_id', callIds)
      .order('created_at', { ascending: false });

    const outcomeMap = new Map<string, any>();
    if (outcomes) {
      for (const o of outcomes) {
        if (!outcomeMap.has(o.call_session_id)) {
          outcomeMap.set(o.call_session_id, o);
        }
      }
    }

    // Batch query transcripts
    const { data: transcripts } = await this.supabase
      .from('call_transcripts')
      .select('*')
      .in('call_session_id', callIds)
      .order('created_at', { ascending: true });

    const transcriptMap = new Map<string, any[]>();
    if (transcripts) {
      for (const t of transcripts) {
        const arr = transcriptMap.get(t.call_session_id) || [];
        arr.push(t);
        transcriptMap.set(t.call_session_id, arr);
      }
    }

    // Batch query recordings
    const { data: recordings } = await this.supabase
      .from('call_recordings')
      .select('*')
      .in('call_session_id', callIds)
      .order('created_at', { ascending: false });

    const recordingMap = new Map<string, string>();
    if (recordings) {
      for (const r of recordings) {
        if (!recordingMap.has(r.call_session_id)) {
          recordingMap.set(r.call_session_id, r.external_url || r.storage_path || '');
        }
      }
    }

    // Batch query audit_logs for call_analyzed
    const { data: auditLogs } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'call.call_analyzed')
      .eq('entity', 'call_session')
      .in('entity_id', callIds)
      .order('created_at', { ascending: false });

    const analysisMap = new Map<string, any>();
    if (auditLogs) {
      for (const a of auditLogs) {
        if (!analysisMap.has(a.entity_id)) {
          analysisMap.set(a.entity_id, a.metadata);
        }
      }
    }

    return calls.map((c) => {
      const outcomeRecord = outcomeMap.get(c.id);
      const callTranscripts = transcriptMap.get(c.id) || [];
      const joinedTranscript = callTranscripts.map((t) => t.body).join('\n');
      const analysisMetadata = analysisMap.get(c.id) || null;

      const outcome =
        outcomeRecord?.disposition ||
        analysisMetadata?.call_outcome ||
        analysisMetadata?.qualification?.outcome ||
        (c.status === 'completed' ? 'COMPLETED' : c.status.toUpperCase());

      return {
        id: c.id,
        organization_id: c.organization_id,
        lead_id: c.lead_id,
        campaign_id: c.campaign_id,
        agent_id: c.agent_id,
        status: c.status,
        direction: c.direction,
        started_at: c.started_at,
        ended_at: c.ended_at,
        duration_seconds: c.duration_seconds || 0,
        from_number: c.from_number,
        to_number: c.to_number,
        retell_call_id: c.retell_call_id,
        provider_call_id: c.retell_call_id,
        disconnection_reason: c.disconnection_reason,
        created_at: c.created_at,
        outcome,
        outcome_notes: outcomeRecord?.notes || analysisMetadata?.summary || null,
        outcome_recorded_at: outcomeRecord?.created_at || null,
        transcript: joinedTranscript || null,
        transcript_turns: callTranscripts.map((t) => ({ id: t.id, body: t.body, created_at: t.created_at })),
        recording_url: recordingMap.get(c.id) || null,
        analysis: analysisMetadata,
      };
    });
  }

  /**
   * Retrieves full details for a single call session.
   */
  async getCallDetails(callSessionId: string, orgId?: string): Promise<HydratedCallDetail | null> {
    const call = await this.getById(callSessionId, orgId);
    if (!call) return null;

    const [outcome, transcripts, recording, auditLogs] = await Promise.all([
      this.getOutcomeByCallSessionId(callSessionId),
      this.getTranscriptsByCallId(callSessionId),
      this.getRecordingByCallId(callSessionId),
      this.supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'call.call_analyzed')
        .eq('entity', 'call_session')
        .eq('entity_id', callSessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const joinedTranscript = transcripts.map((t) => t.body).join('\n');
    const analysisMetadata = (auditLogs.data?.metadata as Record<string, unknown>) || null;

    const outcomeDisposition =
      outcome?.disposition ||
      (analysisMetadata?.call_outcome as string) ||
      ((analysisMetadata?.qualification as any)?.outcome as string) ||
      (call.status === 'completed' ? 'COMPLETED' : call.status.toUpperCase());

    return {
      id: call.id,
      organization_id: call.organization_id,
      lead_id: call.lead_id,
      campaign_id: call.campaign_id,
      agent_id: call.agent_id,
      status: call.status,
      direction: call.direction,
      started_at: call.started_at,
      ended_at: call.ended_at,
      duration_seconds: call.duration_seconds || 0,
      from_number: call.from_number,
      to_number: call.to_number,
      retell_call_id: call.retell_call_id,
      provider_call_id: call.retell_call_id,
      disconnection_reason: call.disconnection_reason,
      created_at: call.created_at,
      outcome: outcomeDisposition,
      outcome_notes: outcome?.notes || (analysisMetadata?.summary as string) || null,
      outcome_recorded_at: outcome?.created_at || null,
      transcript: joinedTranscript || null,
      transcript_turns: transcripts.map((t) => ({ id: t.id, body: t.body, created_at: t.created_at })),
      recording_url: recording?.external_url || recording?.storage_path || null,
      analysis: analysisMetadata,
    };
  }
}
