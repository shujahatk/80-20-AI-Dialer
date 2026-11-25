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
    const supabase = await createServerClient(req);
    const service = new LeadsService(supabase);

    const body = await req.json();
    if (!body?.tagName || !body.tagName.trim()) {
      return NextResponse.json({ success: false, error: 'Tag name is required' }, { status: 400 });
    }

    const tag = await service.addTag(id, body.tagName.trim(), body.color, auth.organizationId);

    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await context.params;
    const supabase = await createServerClient(req);
    const service = new LeadsService(supabase);

    const { searchParams } = new URL(req.url);
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json({ success: false, error: 'tagId is required' }, { status: 400 });
    }

    await service.removeTag(id, tagId);

    return NextResponse.json({ success: true, message: 'Tag removed from lead' });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
