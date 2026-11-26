import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import type { ResendSender, ResendSendInput, ResendSendResult } from './engine';
import type { ResendDeliveryNotice } from './delivery';

export function verifyResendWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSeconds = Date.now() / 1000
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 5 * 60) return false;
  const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice('whsec_'.length), 'base64') : Buffer.from(secret);
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest('base64');
  return headers.signature.split(' ').some((part) => {
    const [version, signature] = part.split(',');
    if (version !== 'v1' || !signature) return false;
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

export function parseResendWebhook(payload: unknown): ResendDeliveryNotice | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { type?: unknown; data?: { email_id?: unknown; to?: unknown; created_at?: unknown }; created_at?: unknown };
  const type = body.type;
  const allowed = [
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.bounced',
    'email.complained',
    'email.failed',
    'email.received',
  ];
  if (typeof type !== 'string' || !allowed.includes(type)) return null;
  const emailId = body.data?.email_id;
  if (typeof emailId !== 'string' || !emailId) return null;
  const to = Array.isArray(body.data?.to) ? body.data?.to[0] : body.data?.to;
  return {
    providerEventId: `${type}:${emailId}:${typeof body.created_at === 'string' ? body.created_at : ''}`,
    type: type as ResendDeliveryNotice['type'],
    resendId: emailId,
    recipient: typeof to === 'string' ? to : null,
    occurredAt: new Date().toISOString(),
  };
}

export function createResendSender(): ResendSender {
  return {
    async send(input: ResendSendInput): Promise<ResendSendResult> {
      const env = getServerEnv();
      const apiKey = env.RESEND_API_KEY;
      if (!apiKey || apiKey.includes('mock') || apiKey.includes('your-')) {
        return { ok: false, retryable: true, error: 'Resend is not configured.' };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': input.idempotencyKey,
          },
          body: JSON.stringify({
            from: input.from,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
            reply_to: input.replyTo || undefined,
            attachments: input.attachments && input.attachments.length > 0 ? input.attachments : undefined,
            headers: {
              'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }),
        });
        const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
        if (response.status === 429 || response.status >= 500) {
          return { ok: false, retryable: true, error: body.message || `Resend returned ${response.status}.` };
        }
        if (!response.ok || !body.id) {
          return { ok: false, retryable: false, error: body.message || `Resend rejected the email (${response.status}).` };
        }
        return { ok: true, id: body.id };
      } catch (error) {
        const message = error instanceof Error && error.name === 'AbortError' ? 'Resend timed out.' : 'Resend could not be reached.';
        return { ok: false, retryable: true, error: message };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
