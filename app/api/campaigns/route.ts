import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CampaignsService } from '@/services/campaigns/campaigns.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { campaignCreateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient(req);
    const service = new CampaignsService(supabase);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const result = await service.getCampaigns(auth.organizationId, {
      status,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.campaigns,
      totalCount: result.totalCount,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 20, windowMs: 60 * 1000, prefix: 'campaigns_create' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const body = await req.json();
    const validated = campaignCreateSchema.parse(body);

    const supabase = await createServerClient(req);
    const service = new CampaignsService(supabase);

    const campaign = await service.createCampaign(validated, auth.organizationId, auth.user.id);

    return NextResponse.json(
      {
        success: true,
        data: campaign,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
