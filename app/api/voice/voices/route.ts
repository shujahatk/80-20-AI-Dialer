import { NextRequest, NextResponse } from 'next/server';
import { elevenLabsVoiceProvider } from '@/services/voice/ElevenLabsVoiceProvider';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!isAuthContext(auth)) return auth;

    const voices = await elevenLabsVoiceProvider.listVoices();
    const health = await elevenLabsVoiceProvider.getHealth();

    return NextResponse.json({
      success: true,
      data: {
        voices,
        health,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve voices';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
