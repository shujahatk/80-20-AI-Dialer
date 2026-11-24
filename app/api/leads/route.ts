import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { leadCreateSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient(req);
    const service = new LeadsService(supabase);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const isDncParam = searchParams.get('isDnc');
    const isDnc = isDncParam !== null ? isDncParam === 'true' : undefined;
    const country = searchParams.get('country') || undefined;
    const region = searchParams.get('region') || undefined;
    const source = searchParams.get('source') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 25;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const offset = (page - 1) * limit;

    const result = await service.getLeads(auth.organizationId, {
      search,
      status,
      priority,
      isDnc,
      country,
      region,
      source,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.leads,
      totalCount: result.totalCount,
      metrics: result.metrics,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit) || 1,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 60, windowMs: 60 * 1000, prefix: 'leads_create' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager', 'operator'] });
    if (!isAuthContext(auth)) return auth;

    const body = await req.json();
    const validated = leadCreateSchema.parse(body);

    const supabase = await createServerClient(req);
    const service = new LeadsService(supabase);

    const createdLead = await service.createLead(validated, auth.organizationId, auth.user.id);

    return NextResponse.json(
      {
        success: true,
        data: createdLead,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
