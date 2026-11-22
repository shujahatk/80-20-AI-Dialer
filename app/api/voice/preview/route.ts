import { NextRequest, NextResponse } from 'next/server';
import { elevenLabsVoiceProvider } from '@/services/voice/ElevenLabsVoiceProvider';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { z } from 'zod';

const previewSchema = z.object({
  voiceId: z.string().optional(),
  text: z.string().max(500).optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 15, windowMs: 60 * 1000, prefix: 'voice_preview' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const body = await req.json().catch(() => ({}));
    const validated = previewSchema.parse(body);

    const samplePhrase =
      validated.text ||
      'Hello, this is a real-time sample of my AI voice from ElevenLabs. I can help answer customer questions, qualify opportunities, and schedule appointments.';

    const result = await elevenLabsVoiceProvider.synthesize({
      text: samplePhrase,
      voiceId: validated.voiceId,
      speed: validated.speed,
      stability: validated.stability,
      similarityBoost: validated.similarityBoost,
    });

    return new Response(result.audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': result.audioBuffer.byteLength.toString(),
        'X-Duration-Ms': result.durationMs.toString(),
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
