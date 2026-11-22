import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { RetellTelephonyService } from '@/services/retell/RetellTelephonyService';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { limit: 5, windowMs: 60 * 1000, prefix: 'retell_test_call' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient();
    const service = new RetellTelephonyService(supabase);

    const body = await request.json();
    const { testPhoneNumber, agentId, leadId, dynamicVariables } = body;

    if (!testPhoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Destination test phone number (testPhoneNumber) is required.' },
        { status: 400 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Published AI Agent ID (agentId) is required.' },
        { status: 400 }
      );
    }

    const result = await service.startIsolatedTestCall({
      testPhoneNumber,
      agentId,
      organizationId: auth.organizationId,
      operatorId: auth.user.id,
      leadId,
      dynamicVariables,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error, call: result.call }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Isolated test call initiation failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
