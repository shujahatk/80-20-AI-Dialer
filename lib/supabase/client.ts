import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { getClientEnv } from '../env';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Creates or retrieves a singleton Supabase browser client.
 * Safe for use in Client Components.
 */
export function createClient() {
  if (browserClient) return browserClient;

  const env = getClientEnv();
  browserClient = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return browserClient;
}
