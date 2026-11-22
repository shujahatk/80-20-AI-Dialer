import React from 'react';
import { ChartFrame } from '@/components/ui/chart-frame';
import { ConversionFunnel } from '@/MINETECH-UI-KIT/components/charts/ConversionFunnel';

interface FunnelStep {
  step: string;
  count: string;
  percentage: string;
  width: string;
}

interface PipelineFunnelProps {
  steps?: FunnelStep[];
  overallRate?: string;
  layout?: 'stack' | 'rail';
}

export const PipelineFunnel: React.FC<PipelineFunnelProps> = ({
  steps = [],
  overallRate = '0%',
  layout = 'stack',
}) => {
  const hasCounts = steps.some((step) => Number(step.count) > 0);

  if (layout === 'rail') {
    return (
      <ChartFrame title="Lead funnel" description={`Qualified rate ${overallRate}`}>
        {!hasCounts ? (
          <div className="py-6 text-center text-[13px] text-on-surface-variant">No funnel activity yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {steps.map((item, index) => (
              <div key={item.step} className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-on-surface-muted">
                  {index + 1}. {item.step}
                </div>
                <div className="mt-1 font-mono text-[18px] font-medium tabular-nums text-on-surface">{item.count}</div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-secondary">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: item.width }} />
                </div>
                <div className="mt-1 text-[11px] text-on-surface-variant">{item.percentage}</div>
              </div>
            ))}
          </div>
        )}
      </ChartFrame>
    );
  }

  return (
    <ChartFrame title="Lead funnel" description="Workspace progression">
      {!hasCounts ? (
        <div className="py-8 text-center text-[13px] text-on-surface-variant">No funnel activity yet.</div>
      ) : (
        <>
          <ConversionFunnel
            stages={steps.map((item, index) => ({
              label: item.step,
              value: Number(item.count) || 0,
              color: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-3)'][index % 4],
            }))}
          />
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
            <span className="text-[12px] text-on-surface-variant">Qualified rate</span>
            <span className="text-[13px] font-semibold text-success">{overallRate}</span>
          </div>
        </>
      )}
    </ChartFrame>
  );
};
