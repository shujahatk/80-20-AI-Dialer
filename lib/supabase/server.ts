import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { Database } from './types';
import { getClientEnv } from '../env';

/**
 * Creates a Supabase client for Server Components, Route Handlers, and Server Actions.
 * Resiliently handles both Authorization headers and cookies in Next.js 15 App Router.
 */
export async function createServerSupabaseClient(request?: Request | NextRequest) {
  let cookieStore: any;
  try {
    cookieStore = await cookies();
  } catch {
    cookieStore = { getAll: () => [], setAll: () => {} };
  }

  let headerStore: any = null;
  try {
    headerStore = await headers();
  } catch {
    headerStore = null;
  }

  const env = getClientEnv();
  const authHeader =
    request?.headers?.get('authorization') ||
    headerStore?.get('authorization') ||
    undefined;

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          // If request was provided and has cookies, prefer request.cookies
          if (request && 'cookies' in request && typeof (request as any).cookies?.getAll === 'function') {
            const reqCookies = (request as any).cookies.getAll();
            if (reqCookies && reqCookies.length > 0) {
              return reqCookies;
            }
          }
          return cookieStore.getAll?.() || [];
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set?.(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    }
  );
}

export { createServerSupabaseClient as createServerClient };
