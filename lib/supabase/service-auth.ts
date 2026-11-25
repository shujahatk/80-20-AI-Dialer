import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getServerEnv } from '../env';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let cachedAuthClient: SupabaseClient<Database> | null = null;

/**
 * Returns an authenticated Supabase client for server-side background processes
 * (such as incoming Retell or Resend webhooks) that need to perform operations
 * protected by user-level triggers (e.g. leads table BEFORE UPDATE trigger).
 */
export async function getServiceAuthClient(expectedOrgId?: string): Promise<SupabaseClient<Database> | null> {
  if (typeof window !== 'undefined') {
    throw new Error('[Security Violation] getServiceAuthClient cannot be called from browser');
  }

  const now = Date.now();
  if (cachedAuthClient && cachedToken && now < tokenExpiresAt - 60000) {
    return cachedAuthClient;
  }

  try {
    const env = getServerEnv();
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@gmail.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'Password123!';

    const baseClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: authData, error: authError } = await baseClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (authError || !authData.session) {
      console.warn('[ServiceAuth] Failed to acquire authenticated operator session:', authError?.message);
      return null;
    }

    cachedToken = authData.session.access_token;
    tokenExpiresAt = (authData.session.expires_at ? authData.session.expires_at * 1000 : now + 3600000);

    cachedAuthClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: {
            Authorization: `Bearer ${cachedToken}`,
          },
        },
      }
    );

    return cachedAuthClient;
  } catch (err) {
    console.warn('[ServiceAuth] Error initializing service auth client:', err);
    return null;
  }
}
