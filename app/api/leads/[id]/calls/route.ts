import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(req);
    if (!isAuthContext(auth)) return auth;

    const { id } = await context.params;
    const supabase = await createServerClient(req);
    const callsService = new CallsService(supabase);

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const calls = await callsService.getCallsForLead(id, auth.organizationId, limit);

    return NextResponse.json({ success: true, data: calls });
  } catch (error: unknown) {
    console.error('[API /api/leads/[id]/calls GET] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Failed to fetch lead calls' } },
      { status: 500 }
    );
  }
}
