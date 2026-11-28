import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient(request);
    const callsService = new CallsService(supabase);

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const leadId = request.nextUrl.searchParams.get('leadId') || request.nextUrl.searchParams.get('lead_id');

    if (leadId) {
      const calls = await callsService.getCallsForLead(leadId, auth.organizationId, limit);
      return NextResponse.json({ success: true, data: calls });
    }

    const calls = await callsService.getCalls(auth.organizationId, limit);

    return NextResponse.json({ success: true, data: calls });
  } catch (err: unknown) {
    console.error('[API /api/calls GET] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : 'Failed to fetch calls' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { limit: 30, windowMs: 60 * 1000, prefix: 'calls_initiate' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const body = await request.json();
    const { leadId, campaignId, aiAgentId, recordCall, phoneNumber } = body;

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: { message: 'leadId is required to initiate a call' } },
        { status: 400 }
      );
    }

    const supabase = await createServerClient(request);
    const callsService = new CallsService(supabase);

    const result = await callsService.initiateCall({
      leadId,
      campaignId,
      aiAgentId,
      recordCall: recordCall !== false,
      phoneNumber,
      operatorId: auth.user.id,
      organizationId: auth.organizationId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let message = 'Failed to initiate call';
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === 'object' && err !== null && 'message' in err) {
      message = String((err as any).message);
    } else if (typeof err === 'string') {
      message = err;
    }

    console.error(`[API /api/calls POST] [${correlationId}] Call dispatch error:`, err);

    const isActiveCallConflict = message.includes('already has an active call in progress') || message.includes('uq_call_sessions_active_lead');
    const isReconciliationPending = message.includes('temporarily unreachable') || message.includes('RECONCILIATION_PENDING');

    const match = message.match(/Call ID:\s*([0-9a-f-]{36})/i);
    const activeCallId = match ? match[1] : undefined;

    const errorCode = isActiveCallConflict
      ? 'ACTIVE_CALL_EXISTS'
      : isReconciliationPending
      ? 'RECONCILIATION_PENDING'
      : message.includes('Do Not Call')
      ? 'DNC_RESTRICTED'
      : message.includes('archived')
      ? 'LEAD_ARCHIVED'
      : message.includes('invalid')
      ? 'INVALID_PHONE'
      : 'DISPATCH_FAILED';

    const statusCode = (isActiveCallConflict || message.includes('Do Not Call') || message.includes('archived') || message.includes('invalid')) ? 400 : (isReconciliationPending ? 503 : 500);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message,
          activeCallId,
          canReconcile: Boolean(isActiveCallConflict && activeCallId),
          correlationId,
        },
      },
      { status: statusCode }
    );
  }
}
