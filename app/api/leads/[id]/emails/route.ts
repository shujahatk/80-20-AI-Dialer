import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
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

    const { id: leadId } = await params;
    const supabase = await createServerClient(req);

    const [messagesRes, jobsRes, callbacksRes] = await Promise.all([
      supabase
        .from('email_messages')
        .select('*')
        .eq('organization_id', auth.organizationId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
      supabase
        .from('email_jobs')
        .select('*')
        .eq('organization_id', auth.organizationId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
      supabase
        .from('callbacks')
        .select('*')
        .eq('organization_id', auth.organizationId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
    ]);

    const messages = (messagesRes.data ?? []) as any[];
    const jobs = (jobsRes.data ?? []) as any[];
    const callbacks = (callbacksRes.data ?? []) as any[];

    const messageIds = messages.map((m) => m.id);
    let eventsByMessage = new Map<string, any[]>();
    if (messageIds.length > 0) {
      const { data: eventsData } = await supabase
        .from('email_events')
        .select('*')
        .in('message_id', messageIds)
        .order('created_at', { ascending: true });

      for (const ev of (eventsData ?? []) as any[]) {
        const list = eventsByMessage.get(ev.message_id) ?? [];
        list.push(ev);
        eventsByMessage.set(ev.message_id, list);
      }
    }

    const hydratedMessages = messages.map((m) => ({
      id: m.id,
      jobId: m.job_id,
      callId: m.call_session_id ?? m.call_id ?? null,
      campaignId: m.campaign_id ?? null,
      toEmail: m.to_email,
      fromEmail: m.from_email,
      replyTo: m.reply_to ?? null,
      subject: m.subject,
      textBody: m.text_body,
      htmlBody: m.html_body,
      category: m.category,
      resendId: m.resend_id ?? null,
      status: m.status,
      lastError: m.last_error ?? null,
      acceptedAt: m.accepted_at ?? null,
      deliveredAt: m.delivered_at ?? null,
      createdAt: m.created_at,
      events: eventsByMessage.get(m.id) ?? [],
    }));

    const hydratedJobs = jobs.map((j) => ({
      id: j.id,
      callId: j.call_session_id ?? j.call_id ?? null,
      campaignId: j.campaign_id ?? null,
      status: j.status,
      eligibilityReasons: j.eligibility_reasons ?? [],
      qualification: j.qualification ?? null,
      draft: j.draft ?? null,
      lastError: j.last_error ?? null,
      createdAt: j.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        messages: hydratedMessages,
        jobs: hydratedJobs,
        callbacks,
      },
    });
  } catch (error: unknown) {
    const err = sanitizeError(error);
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
  }
}
