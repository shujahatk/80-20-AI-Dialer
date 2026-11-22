'use client';

import { cn } from '@/lib/utils';

export interface Insight {
  id: string;
  label: string;
  value: string;
  spark?: number[];
  note?: string;
}

export function InsightCards({
  insights,
  className,
  layout = 'grid',
}: {
  insights: Insight[];
  className?: string;
  layout?: 'grid' | 'strip';
}) {
  return (
    <div
      className={cn(
        layout === 'strip'
          ? 'grid w-full grid-cols-2 overflow-hidden rounded-xl border border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-[#121614] xl:grid-cols-4'
          : 'grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4',
        className
      )}
    >
      {insights.map((insight, index) => (
        <div
          key={insight.id}
          className={cn(
            'p-4 transition-colors duration-150 hover:bg-primary/[0.04]',
            layout === 'strip'
              ? 'border-black/[0.06] dark:border-white/[0.06] [&:nth-child(odd)]:border-r xl:border-r xl:last:border-r-0'
              : 'rounded-xl border border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-[#121614]'
          )}
          style={layout === 'strip' && index > 0 ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">{insight.label}</p>
              <p className="mt-1 font-mono text-[22px] font-medium tabular-nums tracking-[-0.5px] text-[#1c3128] dark:text-neutral-50">
                {insight.value}
              </p>
            </div>
            {insight.spark && insight.spark.length > 0 && (
              <span aria-hidden className="flex h-8 items-end gap-[2px]">
                {insight.spark.map((point, sparkIndex) => (
                  <span
                    key={sparkIndex}
                    className={cn(
                      'w-[3px] origin-bottom rounded-sm motion-safe:animate-[rm-bar-grow_400ms_cubic-bezier(0.22,1,0.36,1)_both]',
                      sparkIndex === insight.spark!.length - 1 ? 'bg-[#243d32] dark:bg-[#8aaa93]' : 'bg-[#243d32]/20 dark:bg-white/15'
                    )}
                    style={{
                      height: `${Math.max(12, Math.min(100, point))}%`,
                      animationDelay: `${sparkIndex * 30}ms`,
                    }}
                  />
                ))}
              </span>
            )}
          </div>
          {insight.note && (
            <p className="mt-2 text-[11.5px] leading-[1.5] text-neutral-500 dark:text-neutral-400">{insight.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}
