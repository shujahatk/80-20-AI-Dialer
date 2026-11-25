import { createClient } from '@/lib/supabase/client';

/**
 * Retrieves client-side authentication headers.
 * Extracts the active Supabase JWT session token so all API requests
 * pass Bearer authentication directly to route handlers.
 */
export async function getClientAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (typeof window !== 'undefined') {
    try {
      const supabase = createClient();
      let session = (await supabase.auth.getSession()).data?.session;

      // Proactively refresh if session token expires within 2 minutes or already expired
      if (session) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        if (expiresAt && Date.now() >= expiresAt - 120000) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) {
            session = refreshed.session;
          }
        }
      }

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // Non-blocking fallback
    }
  }

  return headers;
}

/**
 * Resilient client fetch wrapper that automatically injects
 * Authorization: Bearer <token> from the active Supabase session.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const authHeaders = await getClientAuthHeaders();
  const headers = new Headers(init?.headers);

  // Set no-cache by default
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache');
  }
  if (!headers.has('Pragma')) {
    headers.set('Pragma', 'no-cache');
  }

  // Inject Bearer token if not explicitly overridden
  if (!headers.has('Authorization') && authHeaders['Authorization']) {
    headers.set('Authorization', authHeaders['Authorization']);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
