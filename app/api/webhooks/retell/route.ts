import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
// Note: scheduleFollowUp from '@/services/email/run-follow-up' deferred to Step 7
import { RetellWebhookService } from '@/services/retell/RetellWebhookService';
import type { RetellWebhookEvent } from '@/services/retell/types';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 120, windowMs: 60 * 1000, prefix: 'retell_webhook' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    // 1. Extract raw text body for HMAC signature verification
    const rawBody = await req.text();
    const signature =
      req.headers.get('x-retell-signature') || req.headers.get('X-Retell-Signature');

    let payload: RetellWebhookEvent;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid JSON payload format.' } },
        { status: 400 }
      );
    }

    // 2. Initialize Supabase Client and Service
    const supabase = createAdminClient();
    const webhookService = new RetellWebhookService(supabase);

    const isSignatureValid = await webhookService.verifySignature(rawBody, signature);
    if (!isSignatureValid) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid webhook signature.' } },
        { status: 401 }
      );
    }

    // 3. Process event
    const result = await webhookService.processWebhook(payload, rawBody, signature);

    if (!result.success) {
      const isSignatureError = result.error?.includes('signature');
      return NextResponse.json(
        { success: false, error: { message: result.error } },
        { status: isSignatureError ? 401 : 400 }
      );
    }

    // Note: Follow-up email automation and Resend dispatch are deferred to Step 7.
    // In Step 6, Retell voice call qualification and database synchronization are complete.
    // Follow-up email automation hook will be reconnected in Step 7.
    /*
    if (result.callId && !result.isDuplicate && (result.eventType === 'call_analyzed' || result.eventType === 'call_ended')) {
      const callId = result.callId;
      const trigger = result.eventType === 'call_analyzed' ? 'analyzed' : 'completed';
      after(() => {
        void scheduleFollowUp(callId, trigger).catch((error) => logFollowUpFailure(callId, error));
      });
    }
    */

    return NextResponse.json(
      {
        success: true,
        data: {
          isDuplicate: result.isDuplicate || false,
          eventType: result.eventType,
          callId: result.callId,
          message: result.message,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal webhook error';
    return NextResponse.json(
      { success: false, error: { message: errorMsg } },
      { status: 500 }
    );
  }
}
