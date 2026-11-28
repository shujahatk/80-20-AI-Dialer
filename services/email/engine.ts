import { appendFooter, expectedCategory, generateFollowUpDraft, isDraftInvalid, textToHtml, validateDraft } from './draft';
import { evaluateEmailEligibility, isValidEmail, normalizeEmail } from './eligibility';
import { DuplicateSendError, type MemoryEmailStore } from './memory-store';
import { ClaudeResponseError, ClaudeUnavailableError, qualifyCall, type ClaudeJsonClient } from './qualification';
import { createUnsubscribeToken } from './unsubscribe-token';
import type { EligibilityReason, EmailDraft, FollowUpCall, QualificationResult } from './types';

export type EmailStore = Pick<
  MemoryEmailStore,
  | 'getSettings'
  | 'createJob'
  | 'updateJob'
  | 'claimJob'
  | 'recordStopAllContact'
  | 'findSuppression'
  | 'hasPriorFollowUp'
  | 'countRecentSends'
  | 'insertQueuedMessage'
  | 'claimMessage'
  | 'updateMessage'
  | 'audit'
>;

export interface ResendSendInput {
  to: string;
  from: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  unsubscribeUrl: string;
  attachments?: Array<{ filename: string; content?: string; path?: string }>;
}

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; retryable: boolean; error: string };

export function isResendError(
  result: ResendSendResult
): result is { ok: false; retryable: boolean; error: string } {
  return !result.ok;
}

export interface ResendSender {
  send(input: ResendSendInput): Promise<ResendSendResult>;
}

export interface EngineDeps {
  claude: ClaudeJsonClient;
  sender: ResendSender;
  now: () => Date;
  appUrl: string;
  fromEmail: string;
  replyTo: string;
  unsubscribeSecret: string;
  providerReady?: boolean;
  providerBlockers?: EligibilityReason[];
}

export interface ProcessResult {
  jobId: string | null;
  status: string;
  sent: boolean;
  duplicate: boolean;
  reasons: string[];
}

function backoff(attempts: number, now: Date): string {
  const minutes = [1, 5, 15, 60][Math.min(attempts - 1, 3)] ?? 60;
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

function formatFrom(senderName: string, fromEmail: string): string {
  if (fromEmail.includes('<')) return fromEmail;
  return `${senderName} <${fromEmail}>`;
}

async function suppress(
  store: EmailStore,
  jobId: string,
  call: FollowUpCall,
  reasons: { code: string; message: string }[],
  now: string,
  qualification?: QualificationResult
): Promise<ProcessResult> {
  await store.updateJob(
    jobId,
    {
      status: 'suppressed',
      eligibilityReasons: reasons,
      qualification,
      lastError: reasons.map((reason) => reason.message).join(' '),
      lockedAt: null,
    },
    now
  );
  await store.audit({
    organizationId: call.organizationId,
    leadId: call.lead?.id ?? null,
    callId: call.callId,
    jobId,
    action: 'email_suppressed',
    detail: { reasons },
    createdAt: now,
  });
  return { jobId, status: 'suppressed', sent: false, duplicate: false, reasons: reasons.map((reason) => reason.code) };
}

export async function processFollowUp(store: EmailStore, deps: EngineDeps, call: FollowUpCall): Promise<ProcessResult> {
  const nowDate = deps.now();
  const now = nowDate.toISOString();
  const job = await store.createJob({
    organizationId: call.organizationId,
    callId: call.callId,
    leadId: call.lead?.id ?? null,
    campaignId: call.campaign?.id ?? null,
    now,
  });

  if (['suppressed', 'accepted', 'delivered', 'bounced', 'complained', 'failed'].includes(job.status)) {
    return { jobId: job.id, status: job.status, sent: false, duplicate: true, reasons: ['duplicate_event'] };
  }

  if (!call.callFinished || !call.analyzed) {
    await store.updateJob(
      job.id,
      {
        status: 'pending',
        nextAttemptAt: new Date(nowDate.getTime() + 2 * 60 * 1000).toISOString(),
        lastError: 'Waiting for a finished call with analysis and a transcript.',
      },
      now
    );
    return { jobId: job.id, status: 'pending', sent: false, duplicate: false, reasons: ['call_not_ready'] };
  }

  const settings = await store.getSettings(call.organizationId);
  if (!settings.enabled || settings.paused) {
    return suppress(
      store,
      job.id,
      call,
      [
        settings.paused
          ? { code: 'automation_paused', message: 'Email automation is paused.' }
          : { code: 'automation_disabled', message: 'Email automation is turned off.' },
      ],
      now
    );
  }

  if (deps.providerReady === false) {
    return suppress(
      store,
      job.id,
      call,
      deps.providerBlockers?.length
        ? deps.providerBlockers
        : [{ code: 'provider_not_verified', message: 'Email sending is not verified.' }],
      now
    );
  }

  const claim = await store.claimJob(job.id, now, true);
  if (claim === 'terminal') {
    return { jobId: job.id, status: job.status, sent: false, duplicate: true, reasons: ['duplicate_event'] };
  }
  if (claim === 'busy' || claim === 'waiting') {
    return { jobId: job.id, status: job.status, sent: false, duplicate: claim === 'busy', reasons: [claim] };
  }

  let qualification: QualificationResult | undefined;
  if (call.outcome && call.outcome.disposition === 'QUALIFIED') {
    qualification = {
      status: 'QUALIFIED',
      interestLevel: 'high',
      customerRequirements: (call.campaign?.requiredCommercialInfo && call.campaign.requiredCommercialInfo.length > 0)
        ? call.campaign.requiredCommercialInfo
        : ['commercial interest confirmed'],
      mainObjections: [],
      requestedInformation: [],
      nextRecommendedAction: 'Commercial follow-up with quotation and technical catalog',
      emailFollowUpEligible: true,
      evidence: [{ quote: call.outcome.notes || 'Prospect met qualification criteria during commercial call', speaker: 'ai' }],
      insufficientEvidence: false,
    };
  } else if (call.outcome && ['NEEDS_REVIEW', 'ENGAGED', 'REJECTED', 'DO_NOT_CALL', 'NO_ANSWER', 'CALLBACK_REQUESTED'].includes(call.outcome.disposition)) {
    qualification = {
      status: call.outcome.disposition === 'DO_NOT_CALL' ? 'DO_NOT_CONTACT' : 'REVIEW_REQUIRED',
      interestLevel: 'none',
      customerRequirements: [],
      mainObjections: [],
      requestedInformation: [],
      nextRecommendedAction: 'No marketing email authorized',
      emailFollowUpEligible: false,
      evidence: [],
      insufficientEvidence: true,
    };
  } else {
    try {
      qualification = await qualifyCall(call, deps.claude);
    } catch (error) {
      if (error instanceof ClaudeUnavailableError) {
        const attempts = job.attempts + 1;
        const permanent = attempts >= 5;
        await store.updateJob(
          job.id,
          {
            status: permanent ? 'failed' : 'retry',
            attempts,
            nextAttemptAt: permanent ? null : backoff(attempts, nowDate),
            lastError: 'Claude is unavailable. The follow-up was not sent.',
            lockedAt: null,
          },
          now
        );
        return { jobId: job.id, status: permanent ? 'failed' : 'retry', sent: false, duplicate: false, reasons: ['claude_unavailable'] };
      }
      const reasons = [{ code: 'qualification_invalid', message: error instanceof Error ? error.message : 'Qualification failed.' }];
      return suppress(store, job.id, call, reasons, now);
    }
  }

  await store.updateJob(job.id, { qualification }, now);

  if (qualification.status === 'DO_NOT_CONTACT' && call.lead) {
    call.lead.stopAllContact = true;
    await store.recordStopAllContact({
      organizationId: call.organizationId,
      leadId: call.lead.id,
      email: call.lead.email,
    });
  }

  const category = expectedCategory(qualification);
  const suppression = call.lead?.email ? await store.findSuppression(call.organizationId, call.lead.email) : null;
  const alreadySent =
    call.lead && call.campaign
      ? await store.hasPriorFollowUp({
        organizationId: call.organizationId,
        leadId: call.lead.id,
        campaignId: call.campaign.id,
        category,
        excludingJobId: job.id,
      })
      : false;
  const decision = evaluateEmailEligibility({
    call,
    qualification,
    suppression,
    alreadySent,
    automationEnabled: settings.enabled,
    automationPaused: settings.paused,
  });

  if (!decision.eligible || !call.lead || !call.campaign || !isValidEmail(call.lead.email)) {
    return suppress(store, job.id, call, decision.reasons, now, qualification);
  }

  const recipient = normalizeEmail(call.lead.email);
  let draft: EmailDraft;
  try {
    if (call.campaign?.emailSubject && call.campaign?.emailBody) {
      let subj = call.campaign.emailSubject;
      let textB = call.campaign.emailBody;
      const contactName = call.lead?.firstName ? `${call.lead.firstName} ${call.lead.lastName || ''}`.trim() : 'there';
      const companyName = call.lead?.companyName || 'your organization';
      const material = qualification.customerRequirements.length > 0 ? qualification.customerRequirements.join(', ') : 'commercial material requirements';
      const volume = qualification.requestedInformation.length > 0 ? qualification.requestedInformation.join(', ') : 'discussed volume';
      const nextStep = qualification.nextRecommendedAction || 'commercial quotation and follow-up discussion';

      const applyPlaceholders = (tpl: string) =>
        tpl
          .replace(/\{\{\s*contact_name\s*\}\}/gi, contactName)
          .replace(/\{\{\s*name\s*\}\}/gi, contactName)
          .replace(/\{\{\s*company_name\s*\}\}/gi, companyName)
          .replace(/\{\{\s*company\s*\}\}/gi, companyName)
          .replace(/\{\{\s*material_interest\s*\}\}/gi, material)
          .replace(/\{\{\s*product_interest\s*\}\}/gi, material)
          .replace(/\{\{\s*estimated_volume\s*\}\}/gi, volume)
          .replace(/\{\{\s*volume\s*\}\}/gi, volume)
          .replace(/\{\{\s*next_steps\s*\}\}/gi, nextStep);

      subj = applyPlaceholders(subj);
      textB = applyPlaceholders(textB);

      const campaignEvidence = qualification.evidence.length > 0 && qualification.evidence[0].quote.length >= 8
        ? [qualification.evidence[0].quote.slice(0, 240)]
        : [];
      draft = {
        subject: subj,
        textBody: textB,
        htmlBody: textToHtml(textB),
        category,
        evidenceReferences: campaignEvidence,
      };
    } else {
      draft = await generateFollowUpDraft(call, qualification, settings.senderName, settings.companyBlurb, deps.claude);
    }
  } catch (error) {
    if (error instanceof ClaudeUnavailableError) {
      const attempts = job.attempts + 1;
      await store.updateJob(
        job.id,
        {
          status: attempts >= 5 ? 'failed' : 'retry',
          attempts,
          nextAttemptAt: attempts >= 5 ? null : backoff(attempts, nowDate),
          lastError: 'Claude is unavailable. The follow-up was not sent.',
          lockedAt: null,
        },
        now
      );
      return { jobId: job.id, status: attempts >= 5 ? 'failed' : 'retry', sent: false, duplicate: false, reasons: ['claude_unavailable'] };
    }
    const message = error instanceof ClaudeResponseError ? error.message : 'The email draft could not be read.';
    return suppress(store, job.id, call, [{ code: 'draft_rejected', message }], now, qualification);
  }

  const validated = validateDraft(draft, call, qualification);
  if (isDraftInvalid(validated)) {
    return suppress(
      store,
      job.id,
      call,
      validated.reasons.map((message) => ({ code: 'draft_rejected', message })),
      now,
      qualification
    );
  }

  if (!deps.fromEmail) {
    const attempts = job.attempts + 1;
    await store.updateJob(
      job.id,
      {
        status: attempts >= 5 ? 'failed' : 'retry',
        attempts,
        draft: validated.draft,
        nextAttemptAt: attempts >= 5 ? null : backoff(attempts, nowDate),
        lastError: 'Resend sender is not configured.',
        lockedAt: null,
      },
      now
    );
    return { jobId: job.id, status: attempts >= 5 ? 'failed' : 'retry', sent: false, duplicate: false, reasons: ['resend_not_configured'] };
  }

  const recent = await store.countRecentSends(call.organizationId, new Date(nowDate.getTime() - 60 * 60 * 1000).toISOString());
  if (recent >= settings.hourlySendLimit) {
    await store.updateJob(
      job.id,
      {
        status: 'queued',
        draft: validated.draft,
        nextAttemptAt: new Date(nowDate.getTime() + 60 * 60 * 1000).toISOString(),
        lastError: 'Hourly send limit reached.',
        lockedAt: null,
      },
      now
    );
    return { jobId: job.id, status: 'queued', sent: false, duplicate: false, reasons: ['rate_limited'] };
  }

  const fresh = await store.getSettings(call.organizationId);
  if (!fresh.enabled || fresh.paused) {
    return suppress(
      store,
      job.id,
      call,
      [{ code: 'automation_paused', message: 'Email automation was paused before the send.' }],
      now,
      qualification
    );
  }

  const unsubscribeUrl = `${deps.appUrl.replace(/\/$/, '')}/api/email/unsubscribe?token=${createUnsubscribeToken(
    { organizationId: call.organizationId, leadId: call.lead.id, email: recipient },
    deps.unsubscribeSecret,
    nowDate.getTime()
  )}`;
  const signature = call.campaign?.companySignature || fresh.senderName;
  const rendered = appendFooter(validated.draft.textBody, textToHtml(validated.draft.textBody), signature, unsubscribeUrl);
  let message;
  try {
    message = await store.insertQueuedMessage(
      {
        jobId: job.id,
        organizationId: call.organizationId,
        leadId: call.lead.id,
        campaignId: call.campaign.id,
        callId: call.callId,
        toEmail: recipient,
        fromEmail: formatFrom(fresh.senderName, deps.fromEmail),
        replyTo: deps.replyTo || null,
        subject: validated.draft.subject,
        htmlBody: rendered.htmlBody,
        textBody: rendered.textBody,
        category: validated.draft.category,
        idempotencyKey: job.idempotencyKey,
      },
      now
    );
  } catch (error) {
    if (error instanceof DuplicateSendError) {
      return suppress(
        store,
        job.id,
        call,
        [{ code: 'duplicate_follow_up', message: 'This follow-up was already queued for the lead and campaign.' }],
        now,
        qualification
      );
    }
    throw error;
  }

  const claimedMessage = await store.claimMessage(message.id, now);
  if (!claimedMessage) {
    return { jobId: job.id, status: message.status, sent: false, duplicate: true, reasons: ['duplicate_send'] };
  }

  await store.updateJob(job.id, { status: 'queued', draft: validated.draft, lockedAt: now }, now);
  const campaignAttachments = (call.campaign?.attachments || []).map((att: any) => {
    if (typeof att === 'object' && att !== null) {
      const obj: { filename: string; content?: string; path?: string } = {
        filename: att.filename || 'attachment.pdf',
      };
      if (att.content) obj.content = att.content;
      if (att.path) obj.path = att.path;
      return obj;
    }
    return {
      filename: String(att).split('/').pop() || 'attachment.pdf',
      path: String(att),
    };
  });

  const sendResult = await deps.sender.send({
    to: recipient,
    from: formatFrom(fresh.senderName, deps.fromEmail),
    replyTo: deps.replyTo || null,
    subject: validated.draft.subject,
    html: rendered.htmlBody,
    text: rendered.textBody,
    idempotencyKey: job.idempotencyKey,
    unsubscribeUrl,
    attachments: campaignAttachments.length > 0 ? campaignAttachments : undefined,
  });

  if (isResendError(sendResult)) {
    const attempts = job.attempts + 1;
    const permanent = !sendResult.retryable || attempts >= 5;
    await store.updateMessage(
      message.id,
      { status: permanent ? 'failed' : 'queued', lastError: sendResult.error },
      now
    );
    await store.updateJob(
      job.id,
      {
        status: permanent ? 'failed' : 'retry',
        attempts,
        nextAttemptAt: permanent ? null : backoff(attempts, nowDate),
        lastError: sendResult.error,
        lockedAt: null,
      },
      now
    );
    await store.audit({
      organizationId: call.organizationId,
      leadId: call.lead.id,
      callId: call.callId,
      jobId: job.id,
      action: permanent ? 'email_failed' : 'email_retry',
      detail: { error: sendResult.error },
      createdAt: now,
    });
    return {
      jobId: job.id,
      status: permanent ? 'failed' : 'retry',
      sent: false,
      duplicate: false,
      reasons: [permanent ? 'resend_failed' : 'resend_retry'],
    };
  }

  await store.updateMessage(message.id, { status: 'accepted', resendId: sendResult.id, acceptedAt: now, lastError: null }, now);
  await store.updateJob(job.id, { status: 'accepted', attempts: job.attempts + 1, lastError: null, lockedAt: null }, now);
  await store.audit({
    organizationId: call.organizationId,
    leadId: call.lead.id,
    callId: call.callId,
    jobId: job.id,
    action: 'email_accepted',
    detail: { resendId: sendResult.id, note: 'Provider acceptance is not delivery.' },
    createdAt: now,
  });
  return { jobId: job.id, status: 'accepted', sent: true, duplicate: false, reasons: [] };
}
