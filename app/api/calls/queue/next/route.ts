import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: { message: 'campaignId is required' } },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const callsService = new CallsService(supabase);

    const result = await callsService.prepareNextCampaignCall({
      campaignId,
      organizationId: auth.organizationId,
      operatorId: auth.user.id,
    });

    if (!result) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No callable candidates available in queue at this time',
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    console.error('[API /api/calls/queue/next POST] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : 'Failed to prepare next call' } },
      { status: 400 }
    );
  }
}
