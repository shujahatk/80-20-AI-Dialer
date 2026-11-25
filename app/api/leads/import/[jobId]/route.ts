import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ImportJobsRepository } from '@/repositories/import-jobs.repository';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(req);
    if (!isAuthContext(auth)) return auth;

    const { jobId } = await context.params;
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = await createServerClient(req);
    const repo = new ImportJobsRepository(supabase);

    const job = await repo.getById(jobId, auth.organizationId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Import job not found' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: job,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.statusCode, headers: NO_CACHE_HEADERS }
    );
  }
}
