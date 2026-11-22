import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

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

    const notes = await service.getNotes(id);
    return NextResponse.json({ success: true, data: notes });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await context.params;
    const supabase = await createServerClient();
    const service = new LeadsService(supabase);

    const body = await req.json();
    if (!body?.content || !body.content.trim()) {
      return NextResponse.json({ success: false, error: 'Note content cannot be empty' }, { status: 400 });
    }

    const note = await service.addNote(id, body.content.trim(), auth.user.id);

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
