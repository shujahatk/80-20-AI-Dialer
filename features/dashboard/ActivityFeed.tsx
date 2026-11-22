import React from 'react';
import Link from 'next/link';
import { ChartFrame } from '@/components/ui/chart-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { buildActivityItems } from '@/lib/ui/activity-items';
import type { Campaign, Lead } from '@/types';
import type { OperationsCall } from '@/lib/ui/operations-summary';

export function ActivityFeed({
  calls,
  leads,
  campaigns,
}: {
  calls: OperationsCall[];
  leads: Lead[];
  campaigns: Campaign[];
}) {
  const items = buildActivityItems({ calls, campaigns, leads, limit: 7 });

  return (
    <ChartFrame title="Operational activity" description="Events from current workspace records">
      {items.length === 0 ? (
        <EmptyState title="No activity yet" description="Calls, campaign starts, and qualified leads will appear here." />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href || '/dashboard'}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 transition-colors duration-fast hover:border-border-strong"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-on-surface">{item.title}</div>
                <div className="truncate text-[12px] text-on-surface-variant">{item.detail}</div>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-on-surface-muted">{item.time}</span>
            </Link>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}
