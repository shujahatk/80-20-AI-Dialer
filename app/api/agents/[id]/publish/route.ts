import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AgentsService, type AgentStudioUserRole } from '@/services/agents/agents.service';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rate = await checkRateLimit(request, { limit: 10, windowMs: 60 * 1000, prefix: 'agents_publish' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();
    const service = new AgentsService(supabase);

    const role = auth.role as AgentStudioUserRole;
    const result = await service.publishAgent(id, auth.organizationId, role, auth.user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error, warnings: result.warnings }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Publishing failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
