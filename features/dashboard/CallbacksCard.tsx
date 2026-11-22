'use client';

import React from 'react';
import Link from 'next/link';
import { ChartFrame } from '@/components/ui/chart-frame';
import { EmptyState } from '@/components/ui/empty-state';

interface CallbackItem {
  id: string;
  name: string;
  company: string;
  time: string;
}

interface CallbacksCardProps {
  callbacks?: CallbackItem[];
  totalCount?: number;
}

export const CallbacksCard: React.FC<CallbacksCardProps> = ({
  callbacks = [],
  totalCount = 0,
}) => {
  return (
    <ChartFrame
      title="Follow-ups"
      description="Callback and next-action queue"
      action={<span className="text-[12px] font-semibold text-on-surface-muted">{totalCount}</span>}
    >
      {callbacks.length === 0 ? (
        <EmptyState icon="schedule" title="No callbacks scheduled" description="Follow-ups appear from lead next actions." />
      ) : (
        <div className="flex flex-col gap-2">
          {callbacks.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
              <div className="truncate text-[13.5px] font-semibold text-on-surface">{item.name}</div>
              <div className="truncate text-[12px] text-on-surface-variant">{item.company}</div>
              <div className="mt-1 text-[12px] font-medium text-primary">{item.time}</div>
            </div>
          ))}
        </div>
      )}
      <Link
        href="/workstation?tab=callbacks"
        className="mt-4 block rounded-md border border-border bg-surface-elevated py-2 text-center text-[12.5px] font-semibold text-on-surface transition-colors hover:bg-surface-secondary"
      >
        Open callback queue
      </Link>
    </ChartFrame>
  );
};
