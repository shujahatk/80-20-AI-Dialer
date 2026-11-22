import React from 'react';

export function MetricCard({
  title,
  value,
  subtext,
  icon,
  spark,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  spark?: number[];
}) {
  const points = Array.isArray(spark) ? spark.filter((point) => Number.isFinite(point)) : [];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const path = points
    .map((point, index) => {
      const x = (index * 56) / Math.max(points.length - 1, 1);
      const y = 16 - ((point - min) / Math.max(max - min, 1)) * 12;
      return `${index ? 'L' : 'M'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div className="panel flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{title}</span>
        {icon ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-surface text-primary" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-[24px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {value === '—' ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-muted" /> : value}
        </div>
        {points.length > 1 ? (
          <svg className="h-4 w-14 shrink-0 text-primary" viewBox="0 0 56 18" aria-hidden="true">
            <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
      {subtext ? <p className="mt-3 border-t border-border pt-2.5 text-[12px] leading-5 text-muted-foreground">{subtext}</p> : null}
    </div>
  );
}
