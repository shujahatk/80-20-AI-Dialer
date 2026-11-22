import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CampaignsService } from '@/services/campaigns/campaigns.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();
    const service = new CampaignsService(supabase);

    const workerId = auth.user.id;
    const result = await service.getNextCallableLead(id, workerId);

    if (!result.candidate) {
      return NextResponse.json({
        success: false,
        message: result.reason || 'No callable leads available right now',
        candidate: null,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      data: result.candidate,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
