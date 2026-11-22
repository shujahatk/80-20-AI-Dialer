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

    const agent = await service.getAgentRowById(id, auth.organizationId);
    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    }

    const version = agent.active_version_id
      ? await service.getAgentVersion(agent.active_version_id)
      : null;

    return NextResponse.json({ success: true, agent, activeVersion: version });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve agent';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
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
    const updated = await service.updateAgent(id, body, auth.organizationId, role, auth.user.id);

    return NextResponse.json({ success: true, agent: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update agent';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
