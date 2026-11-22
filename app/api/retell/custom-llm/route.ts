import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { RetellCustomLLMService, type RetellCustomLLMRequest } from '@/services/retell/RetellCustomLLMService';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 120, windowMs: 60 * 1000, prefix: 'retell_custom_llm' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const body = (await req.json()) as RetellCustomLLMRequest;

    if (!body || !body.interaction_type) {
      return NextResponse.json(
        { error: 'Invalid Custom LLM request: missing interaction_type.' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const customLLMService = new RetellCustomLLMService(supabase);

    const response = await customLLMService.handleCustomLLMTurn(body);

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    console.error('[API/retell/custom-llm] Route error:', err);
    return NextResponse.json(
      {
        response_type: 'response',
        content:
          'I apologize, but our system is currently experiencing a technical delay. A team member will follow up shortly.',
        content_complete: true,
        end_call: true,
      },
      { status: 200 } // Return 200 with safe spoken message so Retell speaks the graceful fallback to the prospect
    );
  }
}
