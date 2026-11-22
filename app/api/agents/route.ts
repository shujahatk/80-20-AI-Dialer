import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AgentsService, type AgentStudioUserRole } from '@/services/agents/agents.service';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { agentCreateSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient();
    const service = new AgentsService(supabase);

    const agents = await service.getAgentRows(auth.organizationId);
    return NextResponse.json({ success: true, agents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve agents';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { limit: 20, windowMs: 60 * 1000, prefix: 'agents_create' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient();
    const service = new AgentsService(supabase);
    const body = await request.json();

    const validated = agentCreateSchema ? agentCreateSchema.parse(body) : body;
    const role = auth.role as AgentStudioUserRole;

    const result = await service.createAgent(validated, auth.organizationId, role, auth.user.id);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create agent';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
