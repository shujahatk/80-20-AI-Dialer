'use client';

import React, { useMemo, useState } from 'react';
import { ChartFrame } from '@/components/ui/chart-frame';
import { EmptyState } from '@/components/ui/empty-state';
import type { OperationsCall } from '@/lib/ui/operations-summary';

interface HourlyVelocityChartProps {
  calls?: OperationsCall[];
  totalCalls?: number;
}

export const HourlyVelocityChart: React.FC<HourlyVelocityChartProps> = ({
  calls = [],
  totalCalls = 0,
}) => {
  const buckets = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    calls.forEach((call) => {
      if (!call.startedAt) return;
      const date = new Date(call.startedAt);
      if (Number.isNaN(date.getTime())) return;
      hours[date.getHours()].count += 1;
    });
    const active = hours.filter((bucket) => bucket.count > 0);
    if (active.length === 0) return hours.slice(8, 18);
    const min = Math.min(...active.map((bucket) => bucket.hour));
    const max = Math.max(...active.map((bucket) => bucket.hour));
    return hours.slice(min, max + 1);
  }, [calls]);

  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const datedCalls = calls.filter((call) => call.startedAt).length;
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <ChartFrame title="Calling by hour" description="Hourly distribution from recorded timestamps">
      {totalCalls === 0 || datedCalls === 0 ? (
        <EmptyState icon="show_chart" title="No hourly activity yet" description="Activity will populate from the call history API." />
      ) : (
        <div>
          <div className="relative flex h-48 items-end gap-1.5">
            {buckets.map((bucket, index) => (
              <div
                key={bucket.hour}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                <div
                  className={`rm-bar w-full rounded-t-md transition-colors ${hovered === index ? 'bg-primary' : 'bg-primary/45'}`}
                  style={{ height: bucket.count ? `${(bucket.count / max) * 100}%` : '2px' }}
                />
                <span className="text-[10px] text-on-surface-muted">{bucket.hour}</span>
              </div>
            ))}
            {hovered !== null && buckets[hovered] && (
              <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-md">
                {buckets[hovered].hour}:00 · {buckets[hovered].count} {buckets[hovered].count === 1 ? 'call' : 'calls'}
              </div>
            )}
          </div>
          <p className="sr-only">
            {buckets.map((bucket) => `${bucket.hour}:00, ${bucket.count} calls.`).join(' ')}
          </p>
        </div>
      )}
    </ChartFrame>
  );
};
