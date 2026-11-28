import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CampaignsService } from '@/services/campaigns/campaigns.service';
import { campaignActionSchema } from '@/lib/validation';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rate = await checkRateLimit(req, { limit: 20, windowMs: 60 * 1000, prefix: 'campaign_actions' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();
    const service = new CampaignsService(supabase);

    const body = await req.json();
    const { action, scheduledAt } = campaignActionSchema.parse(body);

    let updated;
    let dispatchResult = null;
    switch (action) {
      case 'start':
        updated = await service.startCampaign(id, auth.organizationId, auth.user.id);
        try {
          dispatchResult = await service.dispatchCampaignLead(
            id,
            `start_${auth.user.id}`,
            auth.organizationId,
            auth.user.id
          );
        } catch {
          // Non-blocking initial dispatch trigger
        }
        break;
      case 'schedule':
        if (!scheduledAt) {
          return NextResponse.json(
            { success: false, error: 'scheduledAt timestamp is required to schedule a campaign' },
            { status: 400 }
          );
        }
        updated = await service.scheduleCampaign(id, scheduledAt, auth.organizationId, auth.user.id);
        break;
      case 'pause':
        updated = await service.pauseCampaign(id, auth.organizationId, auth.user.id);
        break;
      case 'resume':
        updated = await service.resumeCampaign(id, auth.organizationId, auth.user.id);
        try {
          dispatchResult = await service.dispatchCampaignLead(
            id,
            `resume_${auth.user.id}`,
            auth.organizationId,
            auth.user.id
          );
        } catch {
          // Non-blocking initial dispatch trigger
        }
        break;
      case 'complete':
        updated = await service.completeCampaign(id, auth.organizationId, auth.user.id);
        break;
      case 'cancel':
        updated = await service.cancelCampaign(id, auth.organizationId, auth.user.id);
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Campaign successfully transitioned to ${action}ed state`,
      data: updated,
      dispatch: dispatchResult,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
