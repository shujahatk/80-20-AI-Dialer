import { getServerEnv } from '@/lib/env';
import { shouldRunEmailWorker } from '@/services/email/due';
import { scheduleFollowUp } from '@/services/email/run-follow-up';
import { SupabaseEmailStore } from '@/services/email/supabase-store';

const state = globalThis as { rmEmailWorkerStarted?: boolean };

export async function runEmailWorkerTick(limit = 20): Promise<{ inspected: number; skipped: string | null }> {
  const env = getServerEnv();
  if (!shouldRunEmailWorker(env.NEXT_PUBLIC_SUPABASE_URL)) {
    return { inspected: 0, skipped: 'no-development-database' };
  }
  if (process.env.EMAIL_WORKER_DISABLED === 'true') {
    return { inspected: 0, skipped: 'disabled' };
  }
  const store = new SupabaseEmailStore();
  const due = await store.listDueCallIdsGlobal(new Date().toISOString(), limit);
  for (const callId of due) {
    await scheduleFollowUp(callId, 'completed');
  }
  try {
    await store.redactExpiredBodies();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email retention failed.';
    console.error(`[email-worker] ${message}`);
  }
  return { inspected: due.length, skipped: null };
}

export function startEmailWorker(): void {
  if (state.rmEmailWorkerStarted) return;
  state.rmEmailWorkerStarted = true;
  const env = getServerEnv();
  if (process.env.EMAIL_WORKER_DISABLED === 'true') {
    console.info('[email-worker] Disabled until the server secret is configured.');
    return;
  }
  if (!shouldRunEmailWorker(env.NEXT_PUBLIC_SUPABASE_URL)) {
    console.info('[email-worker] Idle. Jobs stay in the database until a development project is connected.');
    return;
  }
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void runEmailWorkerTick()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Email worker failed.';
        console.error(`[email-worker] ${message}`);
      })
      .finally(() => {
        running = false;
      });
  };
  setInterval(tick, 60_000);
  tick();
}
