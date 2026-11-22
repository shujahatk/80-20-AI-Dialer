import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CallsService } from '@/services/calls/calls.service';
import { sanitizeError } from '@/lib/errors';
import { authenticateRequest, isAuthContext } from '@/lib/auth/server';
import { z } from 'zod';

const addSegmentSchema = z.object({
  speaker: z.enum(['ai', 'lead', 'operator', 'system']),
  sequenceNumber: z.number().int().min(1),
  text: z.string().min(1),
  startedAtMs: z.number().optional(),
  endedAtMs: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!isAuthContext(auth)) return auth;

    const { id } = await params;
    const supabase = await createServerClient();
    const callsService = new CallsService(supabase);

    const call = await callsService.getCallById(id, auth.organizationId);
    if (!call) {
      return NextResponse.json({ success: false, error: 'Call record not found' }, { status: 404 });
    }

    const transcripts = await callsService.getCallTranscripts(id);

    return NextResponse.json({
      success: true,
      data: transcripts,
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.statusCode }
    );
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
    const supabase = await createServerClient();
    const callsService = new CallsService(supabase);

    const call = await callsService.getCallById(id, auth.organizationId);
    if (!call) {
      return NextResponse.json({ success: false, error: 'Call record not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const validated = addSegmentSchema.parse(body);

    const segment = await callsService.recordTranscriptSegment({
      callId: id,
      speaker: validated.speaker,
      sequenceNumber: validated.sequenceNumber,
      text: validated.text,
      startedAtMs: validated.startedAtMs,
      endedAtMs: validated.endedAtMs,
      confidence: validated.confidence,
      metadata: validated.metadata,
    });

    return NextResponse.json(
      {
        success: true,
        data: segment,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.statusCode }
    );
  }
}
