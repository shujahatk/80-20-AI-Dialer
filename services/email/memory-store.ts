import { randomUUID } from 'node:crypto';
import {
  DEFAULT_AUTOMATION_SETTINGS,
  type AuditEntry,
  type AutomationSettings,
  type EmailCounts,
  type EmailEvent,
  type EmailJob,
  type EmailMessage,
  type JobStatus,
  type Suppression,
} from './types';

const TERMINAL: JobStatus[] = ['suppressed', 'accepted', 'delivered', 'bounced', 'complained', 'failed'];
const ACTIVE_MESSAGE = new Set(['queued', 'sending', 'accepted', 'delivered']);

export class DuplicateSendError extends Error {
  constructor() {
    super('A follow-up for this lead and campaign already exists.');
    this.name = 'DuplicateSendError';
  }
}

export interface NewMessage {
  jobId: string;
  organizationId: string;
  leadId: string;
  campaignId: string;
  callId: string;
  toEmail: string;
  fromEmail: string;
  replyTo: string | null;
  subject: string;
  htmlBody: string;
  textBody: string;
  category: EmailMessage['category'];
  idempotencyKey: string;
}

export interface NewEvent {
  organizationId: string;
  messageId: string | null;
  jobId: string | null;
  eventType: string;
  providerEventId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export class MemoryEmailStore {
  settings = new Map<string, AutomationSettings>();
  suppressions: Suppression[] = [];
  jobs: EmailJob[] = [];
  messages: EmailMessage[] = [];
  events: EmailEvent[] = [];
  audits: AuditEntry[] = [];
  stoppedLeads = new Set<string>();
  unsubscribedLeads = new Set<string>();

  async getSettings(organizationId: string): Promise<AutomationSettings> {
    return this.settings.get(organizationId) ?? { ...DEFAULT_AUTOMATION_SETTINGS };
  }

  async saveSettings(organizationId: string, settings: AutomationSettings): Promise<void> {
    this.settings.set(organizationId, { ...settings });
  }

  async findSuppression(organizationId: string, email: string): Promise<Suppression | null> {
    const normalized = email.trim().toLowerCase();
    return this.suppressions.find((item) => item.organizationId === organizationId && item.email === normalized) ?? null;
  }

  async addSuppression(entry: Suppression): Promise<void> {
    const email = entry.email.trim().toLowerCase();
    const existing = this.suppressions.find((item) => item.organizationId === entry.organizationId && item.email === email);
    if (existing) {
      existing.reason = entry.reason;
      return;
    }
    this.suppressions.push({ ...entry, email });
  }

  async countRecentSends(organizationId: string, sinceIso: string): Promise<number> {
    return this.messages.filter(
      (message) =>
        message.organizationId === organizationId &&
        message.createdAt >= sinceIso &&
        ['sending', 'accepted', 'delivered', 'bounced', 'complained'].includes(message.status)
    ).length;
  }

  async hasPriorFollowUp(input: {
    organizationId: string;
    leadId: string;
    campaignId: string;
    category: string;
    excludingJobId?: string;
  }): Promise<boolean> {
    return this.messages.some(
      (message) =>
        message.organizationId === input.organizationId &&
        message.leadId === input.leadId &&
        message.campaignId === input.campaignId &&
        message.jobId !== input.excludingJobId &&
        ACTIVE_MESSAGE.has(message.status)
    );
  }

  async findJobByCallId(callId: string): Promise<EmailJob | null> {
    return this.jobs.find((job) => job.callId === callId) ?? null;
  }

  async createJob(input: { organizationId: string; callId: string; leadId: string | null; campaignId: string | null; now: string }): Promise<EmailJob> {
    const existing = this.jobs.find((job) => job.callId === input.callId || job.idempotencyKey === `followup:${input.callId}`);
    if (existing) return existing;
    const job: EmailJob = {
      id: randomUUID(),
      organizationId: input.organizationId,
      callId: input.callId,
      leadId: input.leadId,
      campaignId: input.campaignId,
      idempotencyKey: `followup:${input.callId}`,
      status: 'pending',
      qualification: null,
      eligibilityReasons: [],
      draft: null,
      attempts: 0,
      nextAttemptAt: null,
      lockedAt: null,
      lastError: null,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.jobs.push(job);
    return job;
  }

  async updateJob(jobId: string, patch: Partial<EmailJob>, now: string): Promise<EmailJob> {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error('Email job not found.');
    Object.assign(job, patch, { updatedAt: now });
    return job;
  }

  async claimJob(jobId: string, nowIso: string, callReady: boolean): Promise<'claimed' | 'terminal' | 'busy' | 'waiting'> {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error('Email job not found.');
    if (TERMINAL.includes(job.status)) return 'terminal';
    if ((job.status === 'retry' || job.status === 'queued') && job.nextAttemptAt && job.nextAttemptAt > nowIso) return 'waiting';
    if (job.status === 'pending' && job.nextAttemptAt && job.nextAttemptAt > nowIso && !callReady) return 'waiting';
    if (job.status === 'sending' && job.lockedAt && Date.parse(nowIso) - Date.parse(job.lockedAt) < 5 * 60 * 1000) return 'busy';
    job.status = 'sending';
    job.lockedAt = nowIso;
    job.updatedAt = nowIso;
    return 'claimed';
  }

  async insertQueuedMessage(input: NewMessage, now: string): Promise<EmailMessage> {
    const existingForJob = this.messages.find((message) => message.jobId === input.jobId);
    if (existingForJob) return existingForJob;
    const prior = this.messages.find(
      (message) =>
        message.organizationId === input.organizationId &&
        message.leadId === input.leadId &&
        message.campaignId === input.campaignId &&
        ACTIVE_MESSAGE.has(message.status)
    );
    if (prior) throw new DuplicateSendError();
    const message: EmailMessage = {
      id: randomUUID(),
      ...input,
      toEmail: input.toEmail.trim().toLowerCase(),
      resendId: null,
      status: 'queued',
      lastError: null,
      acceptedAt: null,
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.messages.push(message);
    return message;
  }

  async claimMessage(messageId: string, now: string): Promise<boolean> {
    const message = this.messages.find((item) => item.id === messageId);
    if (!message || (message.status !== 'queued' && message.status !== 'retry')) return false;
    message.status = 'sending';
    message.updatedAt = now;
    return true;
  }

  async updateMessage(messageId: string, patch: Partial<EmailMessage>, now: string): Promise<EmailMessage> {
    const message = this.messages.find((item) => item.id === messageId);
    if (!message) throw new Error('Email message not found.');
    Object.assign(message, patch, { updatedAt: now });
    return message;
  }

  async findMessageByResendId(resendId: string): Promise<EmailMessage | null> {
    return this.messages.find((message) => message.resendId === resendId) ?? null;
  }

  async recordEvent(event: NewEvent): Promise<'recorded' | 'duplicate'> {
    if (event.providerEventId && this.events.some((item) => item.providerEventId === event.providerEventId)) {
      return 'duplicate';
    }
    this.events.push({ id: randomUUID(), ...event });
    return 'recorded';
  }

  async listEvents(messageId: string): Promise<EmailEvent[]> {
    return this.events.filter((event) => event.messageId === messageId);
  }

  async audit(entry: Omit<AuditEntry, 'id' | 'createdAt'> & { createdAt?: string }): Promise<void> {
    this.audits.push({
      id: randomUUID(),
      createdAt: entry.createdAt ?? new Date().toISOString(),
      organizationId: entry.organizationId,
      leadId: entry.leadId,
      callId: entry.callId,
      jobId: entry.jobId,
      action: entry.action,
      detail: entry.detail,
    });
  }

  async recordStopAllContact(input: { organizationId: string; leadId: string; email: string | null }): Promise<void> {
    this.stoppedLeads.add(input.leadId);
    if (input.email) {
      await this.addSuppression({ organizationId: input.organizationId, email: input.email, reason: 'stop_all' });
    }
  }

  async recordUnsubscribe(input: { organizationId: string; leadId: string; email: string }): Promise<void> {
    this.unsubscribedLeads.add(input.leadId);
    const existing = await this.findSuppression(input.organizationId, input.email);
    if (!existing || existing.reason === 'manual') {
      await this.addSuppression({ organizationId: input.organizationId, email: input.email, reason: 'unsubscribe' });
    }
  }

  async listRecentJobs(organizationId: string, limit: number): Promise<EmailJob[]> {
    return this.jobs.filter((job) => job.organizationId === organizationId).slice(-limit).reverse();
  }

  async counts(organizationId: string): Promise<EmailCounts> {
    const jobs = this.jobs.filter((job) => job.organizationId === organizationId);
    const messages = this.messages.filter((message) => message.organizationId === organizationId);
    return {
      queued: jobs.filter((job) => job.status === 'queued' || job.status === 'retry' || job.status === 'pending').length,
      accepted: messages.filter((message) => message.status === 'accepted' || message.status === 'delivered').length,
      delivered: messages.filter((message) => message.status === 'delivered').length,
      bounced: messages.filter((message) => message.status === 'bounced').length,
      failed: messages.filter((message) => message.status === 'failed').length + jobs.filter((job) => job.status === 'failed').length,
      suppressed: jobs.filter((job) => job.status === 'suppressed').length,
      replies: this.events.filter((event) => event.organizationId === organizationId && event.eventType === 'email.received').length,
    };
  }
}
