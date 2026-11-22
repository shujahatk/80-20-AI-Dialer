import { NextResponse } from 'next/server';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function requireEmailAdmin(): Promise<{ organizationId: string } | NextResponse> {
  const auth = await authenticateRequest(undefined, { allowedRoles: ['admin', 'manager'] });
  if (!isAuthContext(auth)) {
    return auth;
  }
  return { organizationId: auth.organizationId };
}

export function isEmailAdmin(value: { organizationId: string } | NextResponse): value is { organizationId: string } {
  return !(value instanceof NextResponse);
}
