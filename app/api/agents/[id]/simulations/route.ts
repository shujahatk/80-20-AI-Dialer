import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AgentsService, type AgentStudioUserRole } from '@/services/agents/agents.service';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

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

    const simulations = await service.getSimulations(id, auth.organizationId);
    return NextResponse.json({ success: true, simulations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve simulations';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rate = await checkRateLimit(request, { limit: 20, windowMs: 60 * 1000, prefix: 'agents_simulations' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();
    const service = new AgentsService(supabase);
    const body = await request.json().catch(() => ({}));

    const role = auth.role as AgentStudioUserRole;

    if (body.scenarioKey) {
      const result = await service.runSimulation(id, body.scenarioKey, auth.organizationId, role, auth.user.id);
      return NextResponse.json({ success: true, evaluation: result });
    } else {
      const batchResult = await service.runAllSimulations(id, auth.organizationId, role, auth.user.id);
      return NextResponse.json({ success: true, batch: batchResult });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Simulation execution failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
