import { isMockDevMode } from '@/lib/env';

const DUE_STATUSES = new Set(['pending', 'queued', 'retry']);

export function dueCallIds(
  jobs: { callId: string; status: string; nextAttemptAt: string | null }[],
  nowIso: string,
  limit?: number
): string[] {
  const ids = jobs
    .filter((job) => DUE_STATUSES.has(job.status) && (!job.nextAttemptAt || job.nextAttemptAt <= nowIso))
    .map((job) => job.callId);
  return typeof limit === 'number' ? ids.slice(0, limit) : ids;
}

export function shouldRunEmailWorker(supabaseUrl: string): boolean {
  return Boolean(supabaseUrl) && !isMockDevMode();
}
