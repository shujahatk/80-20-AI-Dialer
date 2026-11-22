import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { twilioProvider } from '@/services/telephony/TwilioTelephonyProvider';
import { normalizePhone } from '@/lib/telephony/phone';
import { getClientEnv } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = (formData.get('To') as string) || '';
    const leadId = (formData.get('leadId') as string) || '';
    const callId = (formData.get('callId') as string) || '';
    const campaignId = (formData.get('campaignId') as string) || null;
    const recordCall = formData.get('recordCall') === 'true';

    const supabase = await createServerClient();
    const callsService = new CallsService(supabase);

    let orgId = getClientEnv().NEXT_PUBLIC_DEFAULT_ORG_ID;

    // Dynamically resolve organization isolation from lead if provided
    if (leadId) {
      const { data: leadRow } = await supabase
        .from('leads')
        .select('organization_id')
        .eq('id', leadId)
        .maybeSingle();

      if (leadRow?.organization_id) {
        orgId = leadRow.organization_id;
      }
    }

    // Validate destination number
    const phoneNorm = normalizePhone(to, 'US');
    if (!phoneNorm.isValid || !phoneNorm.e164) {
      const twiml = twilioProvider.generateRejectionTwiml('The phone number is invalid.');
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Final DNC and Callability Guard if leadId is provided
    if (leadId) {
      try {
        await callsService.assertLeadCallable(leadId, orgId);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Call blocked';
        console.warn(`[TwiML] Rejected call to lead ${leadId}:`, errorMsg);
        const twiml = twilioProvider.generateRejectionTwiml('The number cannot be dialed or is on the do not call list.');
        return new NextResponse(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    }

    const twiml = twilioProvider.generateOutboundTwiml({
      destinationNumber: phoneNorm.e164,
      callId: callId || `call_${Date.now()}`,
      leadId: leadId || 'direct_dial',
      campaignId,
      recordCall,
    });

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err: unknown) {
    console.error('[API /api/telephony/twiml] Error:', err);
    const twiml = twilioProvider.generateRejectionTwiml('An error occurred while connecting the call.');
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
