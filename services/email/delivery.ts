import type { EmailStore } from './engine';
import type { MemoryEmailStore } from './memory-store';
import type { JobStatus, MessageStatus } from './types';

export interface ResendDeliveryNotice {
  providerEventId: string;
  type:
    | 'email.sent'
    | 'email.delivered'
    | 'email.delivery_delayed'
    | 'email.bounced'
    | 'email.complained'
    | 'email.failed'
    | 'email.received';
  resendId: string;
  recipient: string | null;
  occurredAt: string;
}

type DeliveryStore = EmailStore &
  Pick<MemoryEmailStore, 'findMessageByResendId' | 'recordEvent' | 'addSuppression' | 'recordUnsubscribe'>;

const MESSAGE_STATUS: Partial<Record<ResendDeliveryNotice['type'], MessageStatus>> = {
  'email.sent': 'accepted',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

const JOB_STATUS: Partial<Record<ResendDeliveryNotice['type'], JobStatus>> = {
  'email.sent': 'accepted',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

export async function applyResendDelivery(
  store: DeliveryStore,
  notice: ResendDeliveryNotice
): Promise<{ applied: boolean; duplicate: boolean }> {
  const message = await store.findMessageByResendId(notice.resendId);
  if (!message) return { applied: false, duplicate: false };
  const recorded = await store.recordEvent({
    organizationId: message.organizationId,
    messageId: message.id,
    jobId: message.jobId,
    eventType: notice.type,
    providerEventId: notice.providerEventId,
    payload: { resendId: notice.resendId, recipient: notice.recipient },
    createdAt: notice.occurredAt,
  });
  if (recorded === 'duplicate') return { applied: false, duplicate: true };
  if (['bounced', 'complained', 'failed'].includes(message.status)) {
    return { applied: true, duplicate: false };
  }
  if (message.status === 'delivered' && notice.type === 'email.sent') {
    return { applied: true, duplicate: false };
  }

  if (notice.type === 'email.received' || notice.type === 'email.delivery_delayed') {
    await store.audit({
      organizationId: message.organizationId,
      leadId: message.leadId,
      callId: message.callId,
      jobId: message.jobId,
      action: notice.type,
      detail: { resendId: notice.resendId },
      createdAt: notice.occurredAt,
    });
    return { applied: true, duplicate: false };
  }

  const status = MESSAGE_STATUS[notice.type];
  if (!status) return { applied: false, duplicate: false };
  await store.updateMessage(
    message.id,
    {
      status,
      deliveredAt: notice.type === 'email.delivered' ? notice.occurredAt : message.deliveredAt,
      lastError: notice.type === 'email.failed' || notice.type === 'email.bounced' ? notice.type : null,
    },
    notice.occurredAt
  );
  const jobStatus = JOB_STATUS[notice.type];
  if (jobStatus) {
    await store.updateJob(message.jobId, { status: jobStatus, lockedAt: null }, notice.occurredAt);
  }
  if (notice.type === 'email.bounced') {
    await store.addSuppression({ organizationId: message.organizationId, email: message.toEmail, reason: 'bounce' });
  }
  if (notice.type === 'email.complained') {
    await store.addSuppression({ organizationId: message.organizationId, email: message.toEmail, reason: 'complaint' });
    await store.recordUnsubscribe({ organizationId: message.organizationId, leadId: message.leadId, email: message.toEmail });
  }
  await store.audit({
    organizationId: message.organizationId,
    leadId: message.leadId,
    callId: message.callId,
    jobId: message.jobId,
    action: `email_${status}`,
    detail: { resendId: notice.resendId, source: 'resend_webhook' },
    createdAt: notice.occurredAt,
  });
  return { applied: true, duplicate: false };
}
