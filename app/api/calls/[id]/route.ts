import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { LeadsRepository } from '@/repositories/leads.repository';
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

    const call = await callsService.getCallById(id, auth.organizationId);
    if (!call) {
      return NextResponse.json(
        { success: false, error: { message: 'Call record not found' } },
        { status: 404 }
      );
    }

    const events = await callsService.getCallEvents(id);
    const recording = await callsService.getCallRecording(id);
    const lead = call.lead_id ? await leadsRepo.getById(call.lead_id, auth.organizationId) : null;

    return NextResponse.json({
      success: true,
      data: {
        ...call,
        events,
        recording,
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
