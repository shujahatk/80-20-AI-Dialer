import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CampaignSchedulerService } from '@/services/campaigns/campaign-scheduler.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

/**
 * Automated Campaign Scheduler & Queue Runner Endpoint.
 * Invoked by Vercel Cron or authenticated CRM operators to:
 * 1. Start scheduled campaigns whose scheduledAt <= now
 * 2. Dispatch queued & retry-eligible leads for running campaigns
 * 3. Reconcile stale active calls
 * 4. Auto-complete finished campaigns
 */
export async function GET(req: NextRequest) {
  return handleCronOrAuth(req);
}

export async function POST(req: NextRequest) {
  return handleCronOrAuth(req);
}

async function handleCronOrAuth(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    let organizationId: string | undefined;
    let operatorId: string | undefined;

    if (!isCronAuthorized) {
      const auth = await authenticateRequest(req);
      if (isAuthContext(auth)) {
        organizationId = auth.organizationId;
        operatorId = auth.user.id;
      } else if (process.env.NODE_ENV === 'production' && cronSecret) {
        return auth;
      }
    }

    const supabase = await createServerClient(req);
    const scheduler = new CampaignSchedulerService(supabase);

    const summary = await scheduler.runCycle({
      organizationId,
      operatorId,
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
