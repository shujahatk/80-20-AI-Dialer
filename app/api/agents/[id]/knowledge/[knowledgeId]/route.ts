import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AgentsService, type AgentStudioUserRole } from '@/services/agents/agents.service';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; knowledgeId: string }> }
) {
  try {
    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const { knowledgeId } = await params;
    const supabase = await createServerClient();
    const service = new AgentsService(supabase);
    const body = await request.json();

    const role = auth.role as AgentStudioUserRole;
    const updated = await service.updateKnowledge(knowledgeId, body, auth.organizationId, role, auth.user.id);

    return NextResponse.json({ success: true, item: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update knowledge item';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; knowledgeId: string }> }
) {
  try {
    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const { knowledgeId } = await params;
    const supabase = await createServerClient();
    const service = new AgentsService(supabase);

    const role = auth.role as AgentStudioUserRole;
    const success = await service.deleteKnowledge(knowledgeId, auth.organizationId, role, auth.user.id);

    return NextResponse.json({ success });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete knowledge item';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
