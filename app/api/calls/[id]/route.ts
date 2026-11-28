import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { LeadsRepository } from '@/repositories/leads.repository';
import { RetellWebhookService } from '@/services/retell/RetellWebhookService';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();
    const callsService = new CallsService(supabase);
    const leadsRepo = new LeadsRepository(supabase);

    const callDetails = await callsService.getCallFullDetails(id, auth.organizationId);
    if (!callDetails) {
      return NextResponse.json(
        { success: false, error: { message: 'Call record not found' } },
        { status: 404 }
      );
    }

    const events = await callsService.getCallEvents(id);
    const lead = callDetails.lead_id ? await leadsRepo.getById(callDetails.lead_id, auth.organizationId) : null;

    return NextResponse.json({
      success: true,
      data: {
        ...callDetails,
        events,
        lead,
      },
    });
  } catch (err: unknown) {
    console.error('[API /api/calls/[id] GET] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : 'Internal Server Error' } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    const supabase = await createServerClient();

    if (action === 'reconcile') {
      const callsService = new CallsService(supabase);
      const result = await callsService.reconcileCall(id, auth.organizationId);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: { message: `Unknown action '${action}'` } },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error('[API /api/calls/[id] POST] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : 'Internal Server Error' } },
      { status: 500 }
    );
  }
}
