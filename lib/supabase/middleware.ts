import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './types';
import { getClientEnv, isMockDevMode } from '../env';

// Public endpoints that do not require an active Supabase user session
const PUBLIC_API_ROUTES = [
  '/api/webhooks/retell',
  '/api/webhooks/resend',
  '/api/webhooks/twilio/call-status',
  '/api/webhooks/twilio/recording',
  '/api/email/unsubscribe',
  '/api/retell/custom-llm',
  '/api/telephony/twiml',
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // 1. Static Assets & Next Internal Files — Pass through without auth check
  const isStaticOrAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.');

  if (isStaticOrAsset) {
    return supabaseResponse;
  }

  const env = getClientEnv();
  const mockDevMode = isMockDevMode();

  // 2. Initialize Supabase Client with Cookie Handling (handles session refresh)
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Check for active session
  let user = null;
  if (!mockDevMode) {
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
  } else {
    // In mock/dev mode, verify presence of dev session cookie
    const devSession = request.cookies.get('rm_session')?.value;
    if (devSession) {
      user = { id: 'usr_dev_operator', email: 'operator@rmlogistics.com' };
    }
  }

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');
  const isPublicApi = PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
  const isApiRoute = pathname.startsWith('/api');

  // 4. Public Webhooks & Callbacks — Allow unauthenticated external calls
  if (isPublicApi) {
    return supabaseResponse;
  }

  // 5. Unauthenticated API Route Protection — Return 401 JSON
  if (isApiRoute && !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Authentication required.' },
      { status: 401 }
    );
  }

  // 6. Unauthenticated Page Route Protection — Redirect to /login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // 7. Authenticated User visiting /login — Redirect to /dashboard
  if (user && isAuthRoute && !pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
