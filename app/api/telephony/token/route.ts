import { NextRequest, NextResponse } from 'next/server';
import { twilioProvider } from '@/services/telephony/TwilioTelephonyProvider';
import { auditProviderConfiguration } from '@/lib/env';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { limit: 20, windowMs: 60 * 1000, prefix: 'telephony_token' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(request);
    if (!isAuthContext(auth)) return auth;

    const audit = auditProviderConfiguration();
    const registerDevice = Boolean(audit.details.twilioSidConfigured);

    const tokenResponse = await twilioProvider.generateAccessToken(auth.user.id, auth.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        ...tokenResponse,
        registerDevice,
      },
    });
  } catch (err: unknown) {
    console.error('[API /api/telephony/token] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Calling service unavailable. Please check telephony credentials.' },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
