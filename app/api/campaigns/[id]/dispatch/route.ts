import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CampaignsService } from '@/services/campaigns/campaigns.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

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

    const result = await service.dispatchCampaignLead(
      id,
      `manual_dispatch_${auth.user.id}`,
      auth.organizationId,
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
