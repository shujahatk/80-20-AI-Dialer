import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import type { ColumnMappingConfig, DuplicateStrategy } from '@/lib/csv/importer';

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 10, windowMs: 60 * 1000, prefix: 'leads_import' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient();
    const service = new LeadsService(supabase);

    const body = await req.json();
    const { action, csvContent, mappings, strategy, targetCampaignId, filename, defaultCountry } = body as {
      action: 'preview' | 'execute';
      csvContent: string;
      mappings: ColumnMappingConfig;
      strategy?: DuplicateStrategy;
      targetCampaignId?: string;
      filename?: string;
      defaultCountry?: string;
    };

    if (!csvContent || typeof csvContent !== 'string') {
      return NextResponse.json({ success: false, error: 'CSV content is required' }, { status: 400 });
    }

    if (!mappings || typeof mappings !== 'object') {
      return NextResponse.json({ success: false, error: 'Column mappings are required' }, { status: 400 });
    }

    if (action === 'preview') {
      const preview = await service.previewCsvImport(
        csvContent,
        mappings,
        defaultCountry ?? 'US',
        auth.organizationId
      );
      return NextResponse.json({ success: true, data: preview });
    }

    if (action === 'execute') {
      const result = await service.executeCsvImport(
        csvContent,
        mappings,
        strategy ?? 'skip',
        targetCampaignId,
        filename ?? 'import.csv',
        auth.organizationId,
        auth.user.id
      );

      return NextResponse.json({
        success: true,
        message: `Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`,
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Must be preview or execute.' }, { status: 400 });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
