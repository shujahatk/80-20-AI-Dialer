'use client';

import React from 'react';

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 148,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" viewBox="0 0 36 36" width={size} height={size}>
        <circle cx="18" cy="18" r={radius} fill="transparent" stroke="var(--surface-secondary)" strokeWidth="3.6" />
        {segments.map((segment) => {
          const length = (segment.value / total) * circumference;
          const dash = `${length} ${circumference - length}`;
          const currentOffset = offset;
          offset += length;
          return (
            <circle
              key={segment.name}
              className="rm-chart-arc"
              cx="18"
              cy="18"
              r={radius}
              fill="transparent"
              stroke={segment.color}
              strokeDasharray={dash}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              strokeWidth="3.6"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-semibold tabular-nums text-on-surface">{centerValue}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-muted">{centerLabel}</span>
      </div>
    </div>
  );
}
