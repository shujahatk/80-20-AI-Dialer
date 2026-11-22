import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getServerEnv } from '../env';

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Creates or retrieves the Supabase Admin client with service_role permissions.
 * DANGER: This client bypasses Row Level Security (RLS).
 * MUST ONLY be imported in server-side code (Route Handlers, Server Actions, Repositories).
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('[RM AI Dialer Security Violation] createAdminClient() cannot be called from browser!');
  }

  if (adminClient) return adminClient;

  const env = getServerEnv();
  adminClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return adminClient;
}
