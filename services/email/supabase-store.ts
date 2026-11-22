import { createAdminClient } from '@/lib/supabase/admin';
import { dueCallIds } from '@/services/email/due';
import { DuplicateSendError, type NewEvent, type NewMessage } from './memory-store';
import {
  DEFAULT_AUTOMATION_SETTINGS,
  type AutomationSettings,
  type EligibilityReason,
  type EmailCounts,
  type EmailDraft,
  type EmailJob,
  type EmailMessage,
  type FollowUpCall,
  type FollowUpCampaign,
  type FollowUpLead,
  type LawfulBasis,
  type QualificationResult,
  type Suppression,
  type TranscriptTurn,
} from './types';

type DbError = { message: string; code?: string } | null;
type DbResult = { data: unknown; error: DbError };

interface Query extends PromiseLike<DbResult> {
  select(columns?: string, options?: unknown): Query;
  insert(values: unknown): Query;
  update(values: unknown): Query;
  upsert(values: unknown, options?: unknown): Query;
  eq(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
  gte(column: string, value: unknown): Query;
  order(column: string, options?: unknown): Query;
  limit(count: number): Query;
  maybeSingle(): Promise<DbResult>;
}

interface AdminClient {
  from(table: string): Query;
  rpc(fn: string, args: Record<string, unknown>): Promise<DbResult>;
}

function db(): AdminClient {
  return createAdminClient() as unknown as AdminClient;
}

function rows<T>(result: DbResult, label: string): T[] {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data as T[] | null) ?? [];
}

function one<T>(result: DbResult, label: string): T | null {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data as T | null) ?? null;
}

const FINISHED = new Set(['completed', 'no_answer', 'busy', 'failed', 'cancelled']);

function asBasis(value: unknown): LawfulBasis | null {
  if (value === 'consent' || value === 'contract' || value === 'legitimate_interest_documented') return value;
  return null;
}

function mapJob(row: Record<string, unknown>): EmailJob {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    callId: String(row.call_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    idempotencyKey: String(row.idempotency_key),
    status: row.status as EmailJob['status'],
    qualification: (row.qualification as QualificationResult | null) ?? null,
    eligibilityReasons: (row.eligibility_reasons as EligibilityReason[] | null) ?? [],
    draft: (row.draft as EmailDraft | null) ?? null,
    attempts: Number(row.attempts ?? 0),
    nextAttemptAt: row.next_attempt_at ? String(row.next_attempt_at) : null,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): EmailMessage {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    organizationId: String(row.organization_id),
    leadId: String(row.lead_id),
    campaignId: String(row.campaign_id),
    callId: String(row.call_id),
    toEmail: String(row.to_email),
    fromEmail: String(row.from_email),
    replyTo: row.reply_to ? String(row.reply_to) : null,
    subject: String(row.subject),
    htmlBody: String(row.html_body),
    textBody: String(row.text_body),
    category: row.category as EmailMessage['category'],
    resendId: row.resend_id ? String(row.resend_id) : null,
    idempotencyKey: String(row.idempotency_key),
    status: row.status as EmailMessage['status'],
    lastError: row.last_error ? String(row.last_error) : null,
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function jobPatch(patch: Partial<EmailJob>, now: string): Record<string, unknown> {
  const column: Record<string, unknown> = { updated_at: now };
  if (patch.status) column.status = patch.status;
  if ('qualification' in patch) column.qualification = patch.qualification;
  if (patch.eligibilityReasons) column.eligibility_reasons = patch.eligibilityReasons;
  if ('draft' in patch) column.draft = patch.draft;
  if (typeof patch.attempts === 'number') column.attempts = patch.attempts;
  if ('nextAttemptAt' in patch) column.next_attempt_at = patch.nextAttemptAt;
  if ('lockedAt' in patch) column.locked_at = patch.lockedAt;
  if ('lastError' in patch) column.last_error = patch.lastError;
  return column;
}

export interface CampaignEmailSetting {
  id: string;
  name: string;
  emailFollowupEnabled: boolean;
  lawfulBasis: LawfulBasis | null;
  lawfulBasisNote: string | null;
}

export class SupabaseEmailStore {
  async getSettings(organizationId: string): Promise<AutomationSettings> {
    const result = await db().from('email_automation_settings').select('*').eq('organization_id', organizationId).maybeSingle();
    const row = one<Record<string, unknown>>(result, 'Email settings');
    if (!row) return { ...DEFAULT_AUTOMATION_SETTINGS };
    return {
      enabled: Boolean(row.enabled),
      paused: Boolean(row.paused),
      hourlySendLimit: Number(row.hourly_send_limit ?? 30),
      senderName: String(row.sender_name ?? 'RM Group'),
      companyBlurb: String(row.company_blurb ?? ''),
      inboundConfigured: Boolean(row.inbound_configured),
      senderDomainVerified: Boolean(row.sender_domain_verified),
    };
  }

  async saveSettings(organizationId: string, settings: AutomationSettings): Promise<void> {
    const result = await db()
      .from('email_automation_settings')
      .upsert(
        {
          organization_id: organizationId,
          enabled: settings.enabled,
          paused: settings.paused,
          hourly_send_limit: settings.hourlySendLimit,
          sender_name: settings.senderName,
          company_blurb: settings.companyBlurb,
          inbound_configured: settings.inboundConfigured,
          sender_domain_verified: settings.senderDomainVerified,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
      )
      .select('organization_id')
      .maybeSingle();
    if (result.error) throw new Error(`Saving email settings: ${result.error.message}`);
  }

  async findSuppression(organizationId: string, email: string): Promise<Suppression | null> {
    const result = await db()
      .from('email_suppressions')
      .select('organization_id, email, reason')
      .eq('organization_id', organizationId)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    const row = one<Record<string, unknown>>(result, 'Email suppression');
    if (!row) return null;
    return { organizationId, email: String(row.email), reason: row.reason as Suppression['reason'] };
  }

  async addSuppression(entry: Suppression): Promise<void> {
    const result = await db()
      .from('email_suppressions')
      .upsert(
        {
          organization_id: entry.organizationId,
          email: entry.email.trim().toLowerCase(),
          reason: entry.reason,
        },
        { onConflict: 'organization_id,email' }
      )
      .select('id')
      .maybeSingle();
    if (result.error) throw new Error(`Saving suppression: ${result.error.message}`);
  }

  async countRecentSends(organizationId: string, sinceIso: string): Promise<number> {
    const result = await db()
      .from('email_messages')
      .select('id, status, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', sinceIso);
    return rows<Record<string, unknown>>(result, 'Recent sends').filter((row) =>
      ['sending', 'accepted', 'delivered', 'bounced', 'complained'].includes(String(row.status))
    ).length;
  }

  async hasPriorFollowUp(input: {
    organizationId: string;
    leadId: string;
    campaignId: string;
    category: string;
    excludingJobId?: string;
  }): Promise<boolean> {
    const result = await db()
      .from('email_messages')
      .select('id, job_id, status')
      .eq('organization_id', input.organizationId)
      .eq('lead_id', input.leadId)
      .eq('campaign_id', input.campaignId);
    return rows<Record<string, unknown>>(result, 'Prior follow-up').some(
      (row) =>
        String(row.job_id) !== input.excludingJobId &&
        ['queued', 'sending', 'accepted', 'delivered'].includes(String(row.status))
    );
  }

  async findJobByCallId(callId: string): Promise<EmailJob | null> {
    const result = await db().from('email_jobs').select('*').eq('call_id', callId).maybeSingle();
    const row = one<Record<string, unknown>>(result, 'Email job');
    return row ? mapJob(row) : null;
  }

  async createJob(input: { organizationId: string; callId: string; leadId: string | null; campaignId: string | null; now: string }): Promise<EmailJob> {
    const inserted = await db()
      .from('email_jobs')
      .insert({
        organization_id: input.organizationId,
        call_id: input.callId,
        lead_id: input.leadId,
        campaign_id: input.campaignId,
        idempotency_key: `followup:${input.callId}`,
        status: 'pending',
        created_at: input.now,
        updated_at: input.now,
      })
      .select('*')
      .maybeSingle();
    if (inserted.error?.code === '23505') {
      const existing = await this.findJobByCallId(input.callId);
      if (existing) return existing;
    }
    const row = one<Record<string, unknown>>(inserted, 'Create email job');
    if (!row) throw new Error('Create email job returned no row.');
    return mapJob(row);
  }

  async updateJob(jobId: string, patch: Partial<EmailJob>, now: string): Promise<EmailJob> {
    const result = await db().from('email_jobs').update(jobPatch(patch, now)).eq('id', jobId).select('*').maybeSingle();
    const row = one<Record<string, unknown>>(result, 'Update email job');
    if (!row) throw new Error('Email job not found.');
    return mapJob(row);
  }

  async claimJob(jobId: string, _nowIso: string, callReady: boolean): Promise<'claimed' | 'terminal' | 'busy' | 'waiting'> {
    const result = await db().rpc('claim_email_job', { target_id: jobId, call_ready: callReady });
    if (result.error) throw new Error(`Claim email job: ${result.error.message}`);
    const value = String(result.data);
    if (value === 'claimed' || value === 'terminal' || value === 'busy' || value === 'waiting') return value;
    throw new Error('Unexpected email job claim result.');
  }

  async insertQueuedMessage(input: NewMessage, now: string): Promise<EmailMessage> {
    const inserted = await db()
      .from('email_messages')
      .insert({
        job_id: input.jobId,
        organization_id: input.organizationId,
        lead_id: input.leadId,
        campaign_id: input.campaignId,
        call_id: input.callId,
        to_email: input.toEmail.trim().toLowerCase(),
        from_email: input.fromEmail,
        reply_to: input.replyTo,
        subject: input.subject,
        html_body: input.htmlBody,
        text_body: input.textBody,
        category: input.category,
        idempotency_key: input.idempotencyKey,
        status: 'queued',
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .maybeSingle();
    if (inserted.error?.code === '23505') {
      const existing = await db().from('email_messages').select('*').eq('job_id', input.jobId).maybeSingle();
      const row = one<Record<string, unknown>>(existing, 'Existing email message');
      if (row) return mapMessage(row);
      throw new DuplicateSendError();
    }
    const row = one<Record<string, unknown>>(inserted, 'Queue email');
    if (!row) throw new Error('Queue email returned no row.');
    return mapMessage(row);
  }

  async claimMessage(messageId: string, now: string): Promise<boolean> {
    const result = await db()
      .from('email_messages')
      .update({ status: 'sending', updated_at: now })
      .eq('id', messageId)
      .in('status', ['queued', 'retry'])
      .select('id');
    return rows<Record<string, unknown>>(result, 'Claim email message').length > 0;
  }

  async updateMessage(messageId: string, patch: Partial<EmailMessage>, now: string): Promise<EmailMessage> {
    const column: Record<string, unknown> = { updated_at: now };
    if (patch.status) column.status = patch.status;
    if ('resendId' in patch) column.resend_id = patch.resendId;
    if ('lastError' in patch) column.last_error = patch.lastError;
    if ('acceptedAt' in patch) column.accepted_at = patch.acceptedAt;
    if ('deliveredAt' in patch) column.delivered_at = patch.deliveredAt;
    const result = await db().from('email_messages').update(column).eq('id', messageId).select('*').maybeSingle();
    const row = one<Record<string, unknown>>(result, 'Update email message');
    if (!row) throw new Error('Email message not found.');
    return mapMessage(row);
  }

  async findMessageByResendId(resendId: string): Promise<EmailMessage | null> {
    const result = await db().from('email_messages').select('*').eq('resend_id', resendId).maybeSingle();
    const row = one<Record<string, unknown>>(result, 'Resend message');
    return row ? mapMessage(row) : null;
  }

  async recordEvent(event: NewEvent): Promise<'recorded' | 'duplicate'> {
    const result = await db()
      .from('email_events')
      .insert({
        organization_id: event.organizationId,
        message_id: event.messageId,
        job_id: event.jobId,
        event_type: event.eventType,
        provider_event_id: event.providerEventId,
        payload: event.payload,
        created_at: event.createdAt,
      })
      .select('id')
      .maybeSingle();
    if (result.error?.code === '23505') return 'duplicate';
    if (result.error) throw new Error(`Email event: ${result.error.message}`);
    return 'recorded';
  }

  async listEvents(messageId: string): Promise<{ eventType: string; createdAt: string; payload: Record<string, unknown> }[]> {
    const result = await db().from('email_events').select('event_type, created_at, payload').eq('message_id', messageId).order('created_at');
    return rows<Record<string, unknown>>(result, 'Email events').map((row) => ({
      eventType: String(row.event_type),
      createdAt: String(row.created_at),
      payload: (row.payload as Record<string, unknown>) ?? {},
    }));
  }

  async audit(entry: { organizationId: string; leadId: string | null; callId: string | null; jobId: string | null; action: string; detail: Record<string, unknown>; createdAt?: string }): Promise<void> {
    const result = await db()
      .from('email_audit_log')
      .insert({
        organization_id: entry.organizationId,
        lead_id: entry.leadId,
        call_id: entry.callId,
        job_id: entry.jobId,
        action: entry.action,
        detail: entry.detail,
        created_at: entry.createdAt ?? new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (result.error) throw new Error(`Email audit: ${result.error.message}`);
    if (entry.callId) {
      await db()
        .from('audit_logs')
        .insert({
          organization_id: entry.organizationId,
          action: `call.${entry.action}`,
          entity: 'call_session',
          entity_id: entry.callId,
          metadata: entry.detail as any,
        })
        .select('id')
        .maybeSingle();
    }
  }

  async recordStopAllContact(input: { organizationId: string; leadId: string; email: string | null }): Promise<void> {
    const result = await db()
      .from('leads')
      .update({
        do_not_call: true,
        notes: 'Customer asked for no further contact during a completed call.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.leadId)
      .eq('organization_id', input.organizationId)
      .select('id')
      .maybeSingle();
    if (result.error) throw new Error(`Stop-all contact: ${result.error.message}`);
    if (input.email) {
      await this.addSuppression({ organizationId: input.organizationId, email: input.email, reason: 'stop_all' });
    }
  }

  async recordUnsubscribe(input: { organizationId: string; leadId: string; email: string }): Promise<void> {
    const result = await db()
      .from('leads')
      .update({ notes: '[Email unsubscribed]', updated_at: new Date().toISOString() })
      .eq('id', input.leadId)
      .eq('organization_id', input.organizationId)
      .select('id')
      .maybeSingle();
    if (result.error) throw new Error(`Unsubscribe: ${result.error.message}`);
    const existing = await this.findSuppression(input.organizationId, input.email);
    if (!existing || existing.reason === 'manual') {
      await this.addSuppression({ organizationId: input.organizationId, email: input.email, reason: 'unsubscribe' });
    }
  }

  async listRecentJobs(organizationId: string, limit: number): Promise<EmailJob[]> {
    const result = await db()
      .from('email_jobs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return rows<Record<string, unknown>>(result, 'Email jobs').map(mapJob);
  }

  async listMessages(organizationId: string): Promise<EmailMessage[]> {
    const result = await db()
      .from('email_messages')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(50);
    return rows<Record<string, unknown>>(result, 'Email messages').map(mapMessage);
  }

  async counts(organizationId: string): Promise<EmailCounts> {
    const [jobsResult, messagesResult, repliesResult] = await Promise.all([
      db().from('email_jobs').select('status').eq('organization_id', organizationId),
      db().from('email_messages').select('status').eq('organization_id', organizationId),
      db().from('email_events').select('id').eq('organization_id', organizationId).eq('event_type', 'email.received'),
    ]);
    const jobs = rows<Record<string, unknown>>(jobsResult, 'Job counts');
    const messages = rows<Record<string, unknown>>(messagesResult, 'Message counts');
    const jobStatus = (status: string) => jobs.filter((job) => job.status === status).length;
    const messageStatus = (status: string) => messages.filter((message) => message.status === status).length;
    return {
      queued: jobStatus('queued') + jobStatus('retry') + jobStatus('pending'),
      accepted: messageStatus('accepted') + messageStatus('delivered'),
      delivered: messageStatus('delivered'),
      bounced: messageStatus('bounced'),
      failed: messageStatus('failed') + jobStatus('failed'),
      suppressed: jobStatus('suppressed'),
      replies: rows<Record<string, unknown>>(repliesResult, 'Replies').length,
    };
  }

  async listCampaigns(organizationId: string): Promise<CampaignEmailSetting[]> {
    const result = await db()
      .from('campaigns')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');
    return rows<Record<string, unknown>>(result, 'Campaigns').map((row) => ({
      id: String(row.id),
      name: String(row.name),
      emailFollowupEnabled: Boolean(row.email_followup_enabled),
      lawfulBasis: asBasis(row.email_lawful_basis),
      lawfulBasisNote: row.email_lawful_basis_note ? String(row.email_lawful_basis_note) : null,
    }));
  }

  async setCampaign(input: {
    organizationId: string;
    campaignId: string;
    emailFollowupEnabled: boolean;
    lawfulBasis: LawfulBasis | null;
    lawfulBasisNote: string | null;
  }): Promise<void> {
    const result = await db()
      .from('campaigns')
      .update({
        email_followup_enabled: input.emailFollowupEnabled,
        email_lawful_basis: input.lawfulBasis,
        email_lawful_basis_note: input.lawfulBasisNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.campaignId)
      .eq('organization_id', input.organizationId)
      .select('id')
      .maybeSingle();
    if (result.error) throw new Error(`Campaign email setting: ${result.error.message}`);
  }

  async listDueCallIds(organizationId: string, nowIso: string): Promise<string[]> {
    const result = await db().from('email_jobs').select('call_id, status, next_attempt_at').eq('organization_id', organizationId);
    return rows<Record<string, unknown>>(result, 'Due email jobs').flatMap((row) =>
      dueCallIds(
        [
          {
            callId: String(row.call_id),
            status: String(row.status),
            nextAttemptAt: row.next_attempt_at ? String(row.next_attempt_at) : null,
          },
        ],
        nowIso
      )
    );
  }

  async listDueCallIdsGlobal(nowIso: string, limit: number): Promise<string[]> {
    const result = await db().from('email_jobs').select('call_id, status, next_attempt_at').limit(500);
    return dueCallIds(
      rows<Record<string, unknown>>(result, 'Due email jobs').map((row) => ({
        callId: String(row.call_id),
        status: String(row.status),
        nextAttemptAt: row.next_attempt_at ? String(row.next_attempt_at) : null,
      })),
      nowIso,
      limit
    );
  }

  async redactExpiredBodies(): Promise<void> {
    const result = await db().rpc('redact_expired_email_bodies', {});
    if (result.error) throw new Error(`Email retention: ${result.error.message}`);
  }

  async loadCall(callId: string, analyzedHint: boolean): Promise<FollowUpCall | null> {
    const callResult = await db()
      .from('call_sessions')
      .select('id, organization_id, lead_id, campaign_id, status, disconnection_reason')
      .eq('id', callId)
      .maybeSingle();
    const call = one<Record<string, unknown>>(callResult, 'Call');
    if (!call) return null;
    const organizationId = String(call.organization_id);
    const [transcriptResult, leadResult, campaignResult, eventResult] = await Promise.all([
      db().from('call_transcripts').select('speaker, text, sequence_number').eq('call_id', callId).order('sequence_number'),
      call.lead_id
        ? db()
          .from('leads')
          .select('id, name, company, email, city, do_not_call, notes, metadata, consent_at')
          .eq('id', call.lead_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      call.campaign_id
        ? db()
          .from('campaigns')
          .select('*')
          .eq('id', call.campaign_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db().from('audit_logs').select('action').eq('entity', 'call_session').eq('entity_id', callId),
    ]);
    const transcript: TranscriptTurn[] = rows<Record<string, unknown>>(transcriptResult, 'Transcript')
      .map((row) => {
        const speaker = String(row.speaker);
        if (speaker !== 'ai' && speaker !== 'lead' && speaker !== 'operator' && speaker !== 'system') return null;
        return { speaker, text: String(row.text ?? '') };
      })
      .filter((turn): turn is TranscriptTurn => Boolean(turn));
    const leadRow = one<Record<string, unknown>>(leadResult, 'Lead');
    const campaignRow = one<Record<string, unknown>>(campaignResult, 'Campaign');
    const analyzed =
      analyzedHint || rows<Record<string, unknown>>(eventResult, 'Call events').some((row) => row.action === 'call.call_analysis_ready' || row.action === 'call_analysis_ready');
    const [firstName = '', ...nameRest] = (leadRow?.name ? String(leadRow.name) : '').split(' ');
    const lastName = nameRest.join(' ');
    const leadMeta = (leadRow?.metadata as Record<string, unknown>) ?? {};
    const lead: FollowUpLead | null = leadRow
      ? {
        id: String(leadRow.id),
        firstName: String(leadRow.first_name || firstName),
        lastName: String(leadRow.last_name || lastName),
        companyName: String(leadRow.company || leadRow.company_name || ''),
        email: leadRow.email ? String(leadRow.email) : null,
        country: String(leadRow.country || leadMeta.country || ''),
        region: String(leadRow.region || leadMeta.region || leadRow.city || ''),
        isDnc: Boolean(leadRow.do_not_call || leadRow.is_dnc),
        unsubscribed: Boolean(leadMeta.unsubscribed || (leadRow.notes && String(leadRow.notes).includes('unsubscribed'))),
        stopAllContact: Boolean(leadRow.do_not_call),
        emailOptIn: Boolean(leadRow.consent_at || leadMeta.email_opt_in),
        lawfulBasis: asBasis(leadMeta.lawful_basis || 'legitimate_interest_documented'),
        lawfulBasisEvidence: leadMeta.lawful_basis_evidence ? String(leadMeta.lawful_basis_evidence) : null,
      }
      : null;
    const campaign: FollowUpCampaign | null = campaignRow
      ? {
        id: String(campaignRow.id),
        name: String(campaignRow.name ?? ''),
        emailFollowupEnabled: Boolean(campaignRow.email_followup_enabled),
        lawfulBasis: asBasis(campaignRow.email_lawful_basis),
        lawfulBasisNote: campaignRow.email_lawful_basis_note ? String(campaignRow.email_lawful_basis_note) : null,
        instructions: campaignRow.email_instructions ? String(campaignRow.email_instructions) : null,
      }
      : null;
    return {
      organizationId,
      callId,
      callStatus: String(call.status),
      callFinished: FINISHED.has(String(call.status)),
      analyzed,
      disconnectionReason: call.disconnection_reason ? String(call.disconnection_reason) : null,
      transcript,
      lead,
      campaign,
    };
  }
}
