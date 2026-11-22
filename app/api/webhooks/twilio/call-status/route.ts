import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CallsService } from '@/services/calls/calls.service';
import { twilioProvider } from '@/services/telephony/TwilioTelephonyProvider';
import type { TwilioStatusCallbackPayload } from '@/services/telephony/types';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { limit: 120, windowMs: 60 * 1000, prefix: 'twilio_status' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const url = request.nextUrl.toString();
    const callId = request.nextUrl.searchParams.get('callId') || undefined;
    const leadId = request.nextUrl.searchParams.get('leadId') || undefined;
    const campaignId = request.nextUrl.searchParams.get('campaignId') || undefined;

    const formData = await request.formData();
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    const signature = request.headers.get('x-twilio-signature') || '';

    // Validate Twilio signature
    const isValidSignature = twilioProvider.validateWebhookSignature(url, payload, signature);

    if (!isValidSignature) {
      console.error('[Twilio Webhook] Invalid signature received.');
      return new NextResponse('Invalid signature', { status: 403 });
    }

    const supabase = createAdminClient();
    const callsService = new CallsService(supabase);

    const result = await callsService.handleTwilioStatusWebhook(
      payload as unknown as TwilioStatusCallbackPayload,
      { callId, leadId, campaignId },
      isValidSignature
    );

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    console.error('[API /api/webhooks/twilio/call-status] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Webhook error' },
      { status: 500 }
    );
  }
}
