import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AgentsService, type AgentStudioUserRole } from '@/services/agents/agents.service';
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
    const service = new AgentsService(supabase);

    const items = await service.listKnowledge(id, auth.organizationId);
    return NextResponse.json({ success: true, knowledge: items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve knowledge items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();
    const service = new AgentsService(supabase);
    const body = await request.json();

    const role = auth.role as AgentStudioUserRole;
    const item = await service.addKnowledge(id, body, auth.organizationId, role, auth.user.id);

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add knowledge item';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
