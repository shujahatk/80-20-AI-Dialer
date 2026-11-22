import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { dispositionAssignSchema } from '@/lib/validation';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const validated = dispositionAssignSchema.parse({
      ...body,
      callId: id,
    });

    const supabase = await createServerClient();
    const callsService = new CallsService(supabase);

    const updated = await callsService.assignDisposition({
      callId: validated.callId,
      leadId: validated.leadId,
      dispositionCode: validated.dispositionCode,
      notes: validated.notes,
      organizationId: auth.organizationId,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    console.error('[API /api/calls/[id]/disposition POST] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : 'Failed to assign disposition' } },
      { status: 400 }
    );
  }
}
