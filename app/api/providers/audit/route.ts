import { NextRequest, NextResponse } from 'next/server';
import { auditProviderConfiguration } from '@/lib/env';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const audit = auditProviderConfiguration();
    return NextResponse.json({
      success: true,
      data: audit,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: { message: err instanceof Error ? err.message : 'Provider audit failed' },
      },
      { status: 500 }
    );
  }
}
