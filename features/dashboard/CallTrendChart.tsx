'use client';

import React, { useMemo, useState } from 'react';
import { ChartFrame } from '@/components/ui/chart-frame';
import { EmptyState } from '@/components/ui/empty-state';
import type { OperationsCall } from '@/lib/ui/operations-summary';
import { classifyCallBucket } from '@/lib/ui/status';

export function CallTrendChart({ calls }: { calls: OperationsCall[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const points = useMemo(() => {
    const dated = calls.filter((call) => call.startedAt && !Number.isNaN(new Date(call.startedAt).getTime()));
    if (dated.length === 0) return [];

    const buckets = new Map<string, { total: number; answered: number }>();
    dated.forEach((call) => {
      const key = new Date(call.startedAt as string).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const current = buckets.get(key) || { total: 0, answered: 0 };
      current.total += 1;
      if (classifyCallBucket(call.outcome, call.status) === 'answered') current.answered += 1;
      buckets.set(key, current);
    });
    return Array.from(buckets.entries()).map(([label, value]) => ({ label, ...value }));
  }, [calls]);

  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...points.map((point) => point.total), 1);
  const coords = points.map((point, index) => {
    const x = pad.left + (points.length === 1 ? innerW / 2 : (innerW * index) / (points.length - 1));
    const y = pad.top + innerH - (point.total / max) * innerH;
    const answeredY = pad.top + innerH - (point.answered / max) * innerH;
    return { ...point, x, y, answeredY };
  });
  const line = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const answered = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.answeredY}`).join(' ');
  const description =
    points.length <= 1
      ? 'One recorded day. The line connects days once calls span more than one date.'
      : 'Recorded calls by day. The pine line is total calls. The lighter line is answered calls.';

  return (
    <ChartFrame title="Call activity" description={points.length === 0 ? 'Recorded calls by day.' : description}>
      {points.length === 0 ? (
        <EmptyState icon="show_chart" title="No dated call history" description="A trend appears after calls include timestamps." />
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible" role="img" aria-label="Call activity by day">
            {(max <= 2 ? [0, 1] : [0, 0.5, 1]).map((tick) => {
              const y = pad.top + innerH * (1 - tick);
              return (
                <g key={tick}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
                  <text x={0} y={y + 3} fill="var(--text-muted)" fontSize="10">
                    {Math.round(max * tick)}
                  </text>
                </g>
              );
            })}
            {coords.length > 1 && (
              <>
                <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rm-chart-arc" />
                <path d={answered} fill="none" stroke="var(--chart-2)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
              </>
            )}
            {coords.map((point, index) => (
              <g key={point.label} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
                <circle cx={point.x} cy={point.y} r={hovered === index ? 5 : 3.5} fill="var(--chart-1)" />
                <text x={point.x} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
          {hovered !== null && coords[hovered] && (
            <div className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-md" style={{ left: `${(coords[hovered].x / width) * 100}%` }}>
              <div className="font-medium text-on-surface">{coords[hovered].label}</div>
              <div className="mt-0.5 text-on-surface-variant">
                {coords[hovered].total} {coords[hovered].total === 1 ? 'call' : 'calls'} · {coords[hovered].answered} answered
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> Total</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--chart-2)]" /> Answered</span>
          </div>
          <p className="sr-only">
            {points.map((point) => `${point.label}: ${point.total} calls, ${point.answered} answered.`).join(' ')}
          </p>
        </div>
      )}
    </ChartFrame>
  );
}
