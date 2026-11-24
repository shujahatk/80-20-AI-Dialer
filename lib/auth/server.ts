import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getClientEnv, isMockDevMode } from '@/lib/env';
import type { UserRole } from '@/lib/supabase/types';

export interface AuthContext {
  user: {
    id: string;
    email: string;
  };
  organizationId: string;
  role: UserRole;
  isDevMock: boolean;
}

export interface AuthOptions {
  allowedRoles?: UserRole[];
}

/**
 * Validates request authentication, retrieves verified organization membership,
 * and enforces role-based access control.
 */
export async function authenticateRequest(
  request?: NextRequest,
  options?: AuthOptions
): Promise<AuthContext | NextResponse> {
  const env = getClientEnv();
  const mockDevMode = isMockDevMode();

  const supabase = await createServerClient(request);
  let user: any = null;

  const authHeader = request?.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7).trim();
    const { data: jwtData, error: jwtError } = await supabase.auth.getUser(jwt);
    if (!jwtError && jwtData?.user) {
      user = jwtData.user;
    }
  }

  if (!user) {
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser();
    user = cookieUser;
  }

  // 1. Check for authenticated user
  if (!user) {
    if (mockDevMode) {
      // In local dev mock mode, check if dev session cookie exists
      const devSession = request?.cookies.get('rm_session')?.value;
      if (devSession) {
        const mockOrgId = env.NEXT_PUBLIC_DEFAULT_ORG_ID;
        const mockRole: UserRole = 'admin';
        if (options?.allowedRoles && !options.allowedRoles.includes(mockRole)) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Insufficient privileges.' },
            { status: 403 }
          );
        }
        return {
          user: { id: 'usr_dev_operator', email: 'operator@rmlogistics.com' },
          organizationId: mockOrgId,
          role: mockRole,
          isDevMock: true,
        };
      }
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized: Authentication required.' },
      { status: 401 }
    );
  }

  // 2. Fetch Profile & Active Organization from Supabase
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: User profile not found.' },
      { status: 403 }
    );
  }

  // Query organization_memberships to resolve organization and app_role (admin, manager, agent)
  const { data: membership, error: memberError } = await supabase
    .from('organization_memberships')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError || !membership || !membership.organization_id) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: User is not assigned to an organization.' },
      { status: 403 }
    );
  }

  const organizationId = membership.organization_id;
  const role: UserRole = (membership.role as UserRole) || 'agent';

  // 3. Enforce Role-Based Access Control
  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    // Map operator and agent interchangeably so both 'operator' and 'agent' pass
    const effectiveAllowed = options.allowedRoles.flatMap((r) =>
      r === 'operator' ? ['operator', 'agent'] : r === 'agent' ? ['agent', 'operator'] : [r]
    );

    if (!effectiveAllowed.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: Operation requires one of [${options.allowedRoles.join(', ')}] permissions.`,
        },
        { status: 403 }
      );
    }
  }

  return {
    user: { id: user.id, email: user.email || '' },
    organizationId,
    role,
    isDevMock: false,
  };
}

/**
 * Type guard for authenticateRequest return value
 */
export function isAuthContext(value: AuthContext | NextResponse): value is AuthContext {
  return !(value instanceof NextResponse);
}
