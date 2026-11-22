import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { applyResendDelivery } from '@/services/email/delivery';
import { parseResendWebhook, verifyResendWebhook } from '@/services/email/resend';
import { SupabaseEmailStore } from '@/services/email/supabase-store';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(request, { limit: 120, windowMs: 60 * 1000, prefix: 'resend_webhook' });
  if (!rate.allowed) return rateLimitExceededResponse(rate);

  const rawBody = await request.text();
  const env = getServerEnv();
  const verified = verifyResendWebhook(
    rawBody,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    env.RESEND_WEBHOOK_SECRET
  );
  if (!verified) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
  const notice = parseResendWebhook(payload);
  if (!notice) return NextResponse.json({ ok: true, ignored: true });
  const headerId = request.headers.get('svix-id');
  if (headerId) notice.providerEventId = headerId;
  try {
    const result = await applyResendDelivery(new SupabaseEmailStore(), notice);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
