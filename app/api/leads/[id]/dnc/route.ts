import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await context.params;
    const supabase = await createServerClient();
    const service = new LeadsService(supabase);

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason || 'Requested Do-Not-Call';

    const updated = await service.markDnc(id, reason, auth.organizationId, auth.user.id);

    return NextResponse.json({
      success: true,
      message: 'Lead marked as DNC',
      data: updated,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(_req, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await context.params;
    const supabase = await createServerClient();
    const service = new LeadsService(supabase);

    const updated = await service.removeDnc(id, auth.organizationId, auth.user.id);

    return NextResponse.json({
      success: true,
      message: 'DNC status cleared',
      data: updated,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
