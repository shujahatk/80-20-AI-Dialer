'use client';

import React from 'react';
import Link from 'next/link';
import { ChartFrame } from '@/components/ui/chart-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { callOutcomeLabel, callOutcomeTone } from '@/lib/ui/status';
import { formatDuration, type OperationsCall } from '@/lib/ui/operations-summary';

interface LiveTelephonyFeedProps {
  calls?: OperationsCall[];
}

export const LiveTelephonyFeed: React.FC<LiveTelephonyFeedProps> = ({ calls = [] }) => {
  return (
    <ChartFrame
      title="Recent calls"
      description="Latest recorded conversations"
      action={
        <Link href="/calls" className="text-[12.5px] font-semibold text-primary hover:underline">
          View history
        </Link>
      }
    >
      {calls.length === 0 ? (
        <EmptyState icon="history" title="No recent calls" description="Completed calls will appear here from the call history API." />
      ) : (
        <div className="flex flex-col gap-2">
          {calls.slice(0, 6).map((call) => (
            <div key={call.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-on-surface">{call.leadName}</div>
                <div className="truncate text-[12px] text-on-surface-variant">
                  {call.company} · {formatDuration(call.durationSeconds)}
                </div>
              </div>
              <Badge tone={callOutcomeTone(call.outcome)}>{callOutcomeLabel(call.outcome, call.outcomeLabel)}</Badge>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
};
