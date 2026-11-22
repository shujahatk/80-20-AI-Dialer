import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { leadUpdateSchema } from '@/lib/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(_req);
    if (!isAuthContext(auth)) return auth;

    const { id } = await context.params;
    const supabase = await createServerClient();
    const service = new LeadsService(supabase);

    const lead = await service.getLeadById(id, auth.organizationId);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: lead });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await context.params;
    const supabase = await createServerClient();
    const service = new LeadsService(supabase);

    const body = await req.json();
    const validated = leadUpdateSchema.parse(body);

    const updated = await service.updateLead(id, validated, auth.organizationId, auth.user.id);

    return NextResponse.json({ success: true, data: updated });
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

    const archived = await service.archiveLead(id, auth.organizationId, auth.user.id);

    return NextResponse.json({
      success: true,
      message: 'Lead safely archived',
      data: archived,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
