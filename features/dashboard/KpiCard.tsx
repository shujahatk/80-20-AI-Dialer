import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/animated-number';
import type { DashboardMetric } from '@/types';

interface KpiCardProps {
  metric: DashboardMetric;
  loading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({ metric, loading }) => {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 transition-[border-color,box-shadow] duration-150 hover:border-primary/30 hover:shadow-sm dark:border-white/[0.08] dark:bg-[#121614]">
      <p className="truncate text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">{metric.title}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1 font-mono text-[22px] font-medium tabular-nums tracking-[-0.5px] text-[#1c3128] dark:text-neutral-50">
          <AnimatedNumber value={metric.value} />
        </p>
      )}
      <p className="mt-2 border-t border-black/[0.05] pt-2 text-[11.5px] text-neutral-500 dark:border-white/[0.06] dark:text-neutral-400">
        {metric.subtext}
      </p>
    </div>
  );
};
