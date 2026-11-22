import { NextRequest, NextResponse } from 'next/server';
import { elevenLabsVoiceProvider } from '@/services/voice/ElevenLabsVoiceProvider';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { z } from 'zod';

const synthesizeSchema = z.object({
  text: z.string().min(1, 'Text is required').max(2000, 'Text exceeds 2,000 characters limit'),
  voiceId: z.string().optional(),
  modelId: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 20, windowMs: 60 * 1000, prefix: 'voice_synthesize' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const body = await req.json().catch(() => ({}));
    const validated = synthesizeSchema.parse(body);

    const result = await elevenLabsVoiceProvider.synthesize({
      text: validated.text,
      voiceId: validated.voiceId,
      modelId: validated.modelId,
      stability: validated.stability,
      similarityBoost: validated.similarityBoost,
      speed: validated.speed,
    });

    return new Response(result.audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': result.audioBuffer.byteLength.toString(),
        'X-Duration-Ms': result.durationMs.toString(),
        'X-TTFB-Ms': result.latencyToFirstByteMs.toString(),
        'X-Character-Count': result.characterCount.toString(),
      },
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.statusCode || 400 }
    );
  }
}
