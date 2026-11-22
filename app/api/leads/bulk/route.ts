import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { leadBulkActionSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 15, windowMs: 60 * 1000, prefix: 'leads_bulk' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient();
    const service = new LeadsService(supabase);

    const body = await req.json();
    const validated = leadBulkActionSchema ? leadBulkActionSchema.parse(body) : body;

    const result = await service.executeBulkAction(validated, auth.organizationId, auth.user.id);

    return NextResponse.json({
      success: true,
      message: `Bulk ${validated.action} successfully applied to ${result.affected} leads`,
      data: result,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
