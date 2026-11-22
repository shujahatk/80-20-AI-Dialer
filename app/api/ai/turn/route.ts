import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ConversationManager } from '@/services/ai/conversation-manager';
import { anthropicLLMProvider } from '@/services/ai/AnthropicLLMProvider';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { z } from 'zod';

const turnSchema = z.object({
  callId: z.string().min(1),
  utterance: z.string().min(1),
  lead: z.object({
    id: z.string(),
    name: z.string(),
    company: z.string(),
    phone: z.string(),
    jobTitle: z.string().optional(),
    email: z.string().nullable().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    timezone: z.string().optional(),
  }),
  campaign: z
    .object({
      id: z.string(),
      name: z.string(),
      objective: z.string().optional(),
      targetMarket: z.string().optional(),
      qualificationGoal: z.string().optional(),
    })
    .optional(),
  agentName: z.string().optional(),
  voiceId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 60, windowMs: 60 * 1000, prefix: 'ai_turn' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient();
    const body = await req.json().catch(() => ({}));
    const validated = turnSchema.parse(body);

    const manager = new ConversationManager(anthropicLLMProvider, supabase);

    // Initialize session context
    manager.getOrCreateContext({
      callId: validated.callId,
      lead: validated.lead,
      campaign: validated.campaign,
      agentName: validated.agentName,
      voiceId: validated.voiceId,
    });

    // Execute turn
    const { response, context } = await manager.processTurn(
      validated.callId,
      validated.utterance
    );

    return NextResponse.json({
      success: true,
      data: {
        spokenResponse: response.spokenResponse,
        stage: response.stage,
        intent: response.intent,
        nextAction: response.nextAction,
        shouldEndCall: response.shouldEndCall,
        contextState: {
          turnCount: context.turns.length,
          currentStage: context.currentStage,
          isEnded: response.shouldEndCall,
        },
      },
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.statusCode }
    );
  }
}
