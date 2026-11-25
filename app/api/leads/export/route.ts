import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { escapeCsvExportValue } from '@/lib/csv/sanitization';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 10, windowMs: 60 * 1000, prefix: 'leads_export' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient(req);
    const service = new LeadsService(supabase);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const isDncParam = searchParams.get('isDnc');
    const isDnc = isDncParam !== null ? isDncParam === 'true' : undefined;

    const { leads } = await service.getLeads(auth.organizationId, {
      status,
      isDnc,
      limit: 5000,
    });

    const headers = [
      'ID',
      'Name',
      'Title',
      'Company',
      'Phone',
      'Email',
      'Timezone',
      'Status',
      'Campaign',
      'Attempts',
      'DNC Restricted',
    ];

    const csvLines = [headers.join(',')];

    for (const lead of leads) {
      const row = [
        escapeCsvExportValue(lead.id),
        escapeCsvExportValue(lead.name),
        escapeCsvExportValue(lead.title),
        escapeCsvExportValue(lead.company),
        escapeCsvExportValue(lead.phone),
        escapeCsvExportValue(lead.email ?? ''),
        escapeCsvExportValue(lead.timezone),
        escapeCsvExportValue(lead.status),
        escapeCsvExportValue(lead.campaignName),
        escapeCsvExportValue(lead.attempts),
        escapeCsvExportValue(lead.status === 'dnc' ? 'YES' : 'NO'),
      ];
      csvLines.push(row.join(','));
    }

    const csvOutput = csvLines.join('\r\n');

    return new NextResponse(csvOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
