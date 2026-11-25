import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CampaignsService } from '@/services/campaigns/campaigns.service';
import { campaignLeadEnrollSchema } from '@/lib/validation';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient(req);
    const service = new CampaignsService(supabase);

    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const result = await service.getEnrolledLeads(id, { state, limit, offset });

    return NextResponse.json({
      success: true,
      data: result.memberships,
      totalCount: result.totalCount,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient(req);
    const service = new CampaignsService(supabase);

    const body = await req.json();
    const { leadIds } = campaignLeadEnrollSchema.parse(body);

    const result = await service.enrollLeads(id, leadIds, auth.organizationId, auth.user.id);

    return NextResponse.json({
      success: true,
      message: `Enrolled ${result.added} leads into campaign`,
      data: result,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
