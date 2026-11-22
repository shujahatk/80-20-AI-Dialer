import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationManager } from '@/services/ai/conversation-manager';
import { anthropicLLMProvider } from '@/services/ai/AnthropicLLMProvider';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rate = await checkRateLimit(req, { limit: 30, windowMs: 60 * 1000, prefix: 'call_summary' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'agent', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();

    // Verify call belongs to the authenticated user's organization
    const { data: callRecord, error: callError } = await supabase
      .from('call_sessions')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', auth.organizationId)
      .maybeSingle();

    if (callError || !callRecord) {
      return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
    }

    const manager = new ConversationManager(anthropicLLMProvider, supabase);
    const summary = await manager.finalizeSession(id);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.statusCode }
    );
  }
}
