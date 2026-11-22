import { NextResponse } from 'next/server';
import { scheduleFollowUp } from '@/services/email/run-follow-up';
import { SupabaseEmailStore } from '@/services/email/supabase-store';
import { isEmailAdmin, requireEmailAdmin } from '../../access';

export async function POST() {
  const access = await requireEmailAdmin();
  if (!isEmailAdmin(access)) return access;
  try {
    const store = new SupabaseEmailStore();
    const due = await store.listDueCallIds(access.organizationId, new Date().toISOString());
    for (const callId of due.slice(0, 20)) {
      await scheduleFollowUp(callId, 'completed');
    }
    return NextResponse.json({ ok: true, inspected: Math.min(due.length, 20) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email jobs could not be retried.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
