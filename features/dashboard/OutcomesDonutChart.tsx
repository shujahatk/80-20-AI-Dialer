'use client';

import React, { useState } from 'react';
import { ChartFrame } from '@/components/ui/chart-frame';
import { DonutChart } from '@/MINETECH-UI-KIT/components/charts/DonutChart';
import { EmptyState } from '@/components/ui/empty-state';

interface OutcomesDonutChartProps {
  segments: Array<{ name: string; value: number; color: string }>;
  totalAnalyzed?: number;
  centerValue?: string;
  centerLabel?: string;
}

export const OutcomesDonutChart: React.FC<OutcomesDonutChartProps> = ({
  segments,
  totalAnalyzed = 0,
  centerValue = '0%',
  centerLabel = 'Answered',
}) => {
  const [active, setActive] = useState<string | null>(null);
  const activeSegment = segments.find((segment) => segment.name === active);

  return (
    <ChartFrame title="Call outcomes" description={`${totalAnalyzed} recorded calls`}>
      {totalAnalyzed === 0 ? (
        <EmptyState icon="pie_chart" title="No call outcomes yet" description="Outcomes appear after the first recorded calls." />
      ) : (
        <DonutChart
          data={segments.map((segment) => ({
            key: segment.name,
            label: segment.name,
            value: segment.value,
            color: segment.color,
          }))}
          centerValue={activeSegment ? String(activeSegment.value) : centerValue}
          centerLabel={activeSegment ? activeSegment.name : centerLabel}
          onSegmentClick={(segment: { label: string }) =>
            setActive((current) => (current === segment.label ? null : segment.label))
          }
          ariaLabel="Call outcomes"
        />
      )}
    </ChartFrame>
  );
};
