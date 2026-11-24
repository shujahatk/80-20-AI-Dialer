import { NextRequest, NextResponse } from 'next/server';
import { auditProviderConfiguration } from '@/lib/env';
import { retellProvider } from '@/services/retell/RetellProvider';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!isAuthContext(auth)) return auth;

    const audit = auditProviderConfiguration();

    // Check live Retell provider readiness if configured
    let retellLiveStatus: 'healthy' | 'degraded' | 'unreachable' | 'unconfigured' = 'unconfigured';
    try {
      const health = await retellProvider.getReadiness();
      retellLiveStatus = health.status;
    } catch {
      retellLiveStatus = 'unreachable';
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: audit.mode,
        aiVoiceRuntime: audit.aiVoiceRuntime,
        providers: {
          twilio: audit.twilio,
          elevenlabs: audit.elevenlabs,
          anthropic: audit.anthropic,
          resend: audit.resend,
          retell: audit.retell,
          supabase: audit.supabase,
        },
        retellHealth: {
          status: retellLiveStatus,
          configured: audit.details.retellKeyConfigured,
        },
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve provider status';
    return NextResponse.json(
      { success: false, error: { message: errorMsg } },
      { status: 500 }
    );
  }
}
