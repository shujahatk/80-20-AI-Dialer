import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let supabaseStatus: 'connected' | 'error' = 'connected';
  let supabaseLatencyMs = 0;
  let supabaseError: string | null = null;

  try {
    const supabase = createAdminClient();
    const queryStart = Date.now();
    const { error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    supabaseLatencyMs = Date.now() - queryStart;

    if (error) {
      supabaseStatus = 'error';
      supabaseError = error.message;
    }
  } catch (err: unknown) {
    supabaseStatus = 'error';
    supabaseError = err instanceof Error ? err.message : 'Database connection error';
  }

  const isHealthy = supabaseStatus === 'connected';

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime ? process.uptime() : 0),
      responseTimeMs: Date.now() - startTime,
      services: {
        database: {
          status: supabaseStatus,
          latencyMs: supabaseLatencyMs,
          ...(supabaseError ? { error: supabaseError } : {}),
        },
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
