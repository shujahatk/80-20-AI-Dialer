import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { SupabaseEmailStore } from '@/services/email/supabase-store';
import { readUnsubscribeToken } from '@/services/email/unsubscribe-token';

async function unsubscribe(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const env = getServerEnv();
  const secret = env.EMAIL_UNSUBSCRIBE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  const payload = readUnsubscribeToken(token, secret);
  if (!payload) {
    return new NextResponse('This unsubscribe link is invalid or expired.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const store = new SupabaseEmailStore();
  await store.recordUnsubscribe({ organizationId: payload.organizationId, leadId: payload.leadId, email: payload.email });
  await store.audit({
    organizationId: payload.organizationId,
    leadId: payload.leadId,
    callId: null,
    jobId: null,
    action: 'email_unsubscribed',
    detail: { email: payload.email },
  });
  return new NextResponse('You are unsubscribed from RM follow-up email. This does not change telephone preferences.', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function GET(request: NextRequest) {
  return unsubscribe(request);
}

export async function POST(request: NextRequest) {
  return unsubscribe(request);
}
