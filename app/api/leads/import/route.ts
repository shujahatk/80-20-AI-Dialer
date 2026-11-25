import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { LeadsService } from '@/services/leads/leads.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import type { ColumnMappingConfig, DuplicateStrategy } from '@/lib/csv/importer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function POST(req: NextRequest) {
  try {
    const rate = await checkRateLimit(req, { limit: 10, windowMs: 60 * 1000, prefix: 'leads_import' });
    if (!rate.allowed) return rateLimitExceededResponse(rate);

    const auth = await authenticateRequest(req, { allowedRoles: ['admin', 'manager'] });
    if (!isAuthContext(auth)) return auth;

    const supabase = await createServerClient(req);
    const service = new LeadsService(supabase);

    const body = await req.json();
    const { action, csvContent, mappings, strategy, targetCampaignId, filename, defaultCountry, jobId } = body as {
      action: 'preview' | 'execute' | 'resume';
      csvContent?: string;
      mappings?: ColumnMappingConfig;
      strategy?: DuplicateStrategy;
      targetCampaignId?: string;
      filename?: string;
      defaultCountry?: string;
      jobId?: string;
    };

    if (action === 'resume') {
      if (!jobId || !targetCampaignId) {
        return NextResponse.json(
          { success: false, error: 'jobId and targetCampaignId are required to resume enrollment' },
          { status: 400 }
        );
      }
      const resumeResult = await service.resumeCampaignEnrollment(
        jobId,
        targetCampaignId,
        auth.organizationId,
        auth.user.id
      );
      return NextResponse.json({
        success: true,
        message: `Campaign enrollment resumed: ${resumeResult.enrolled} enrolled into campaign`,
        data: resumeResult,
      });
    }

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

      const isPartial = result.status === 'partial_success';
      const isAllDuplicates = result.status === 'all_duplicates_skipped' ||
        (result.inserted === 0 && result.updated === 0 && result.skipped > 0 && result.invalid === 0);
      const isNone = result.status === 'no_records_imported' || (result.inserted === 0 && result.updated === 0);
      const message = isAllDuplicates
        ? `All ${result.skipped} records are already saved in your CRM. Existing contacts were preserved without creating duplicates.`
        : isNone
          ? `No new leads were imported. ${result.skipped} duplicate records skipped, ${result.invalid} invalid records rejected.`
          : isPartial
            ? `Partial Success: ${result.inserted} leads inserted, ${result.updated} updated in CRM, but campaign enrollment failed: ${result.campaignEnrollment?.error}`
            : `Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`;

      return NextResponse.json({
        success: true,
        partialSuccess: isPartial,
        noneImported: isNone,
        allDuplicatesSkipped: isAllDuplicates,
        message,
        data: result,
      }, {
        headers: NO_CACHE_HEADERS,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Must be preview or execute.' }, { status: 400 });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
