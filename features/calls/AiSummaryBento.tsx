'use client';

import React from 'react';
import type { Call } from '@/types';
import { Icon } from '@/lib/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';

interface AiSummaryBentoProps {
  call: Call;
}

export const AiSummaryBento: React.FC<AiSummaryBentoProps> = ({ call }) => {
  const summaryText = call.executiveSummary?.trim();
  const facts = Object.entries(call.keyFacts || {}).filter(([, value]) => Boolean(value));
  const nextStep = call.nextStep?.trim();

  if (!summaryText && facts.length === 0 && !nextStep) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <EmptyState
          icon="psychology"
          title="No AI summary yet"
          description="Summaries and captured facts appear here only when generated for this call."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm md:col-span-2">
        <div>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
              <Icon name="psychology" size={18} />
              Executive call summary
            </span>
          </div>
          <p className="pt-2 text-[14px] leading-relaxed text-on-surface">
            {summaryText || 'No narrative summary is stored for this call.'}
          </p>
        </div>
        {nextStep && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[13px]">
            <span className="font-medium text-on-surface-variant">Next action:</span>
            <span className="rounded border border-accent/20 bg-accent-surface px-2.5 py-1 font-semibold text-primary">
              {nextStep}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <span className="flex items-center gap-1.5 border-b border-border pb-2 text-[14px] font-semibold text-on-surface">
          <Icon name="fact_check" size={18} className="text-secondary" />
          Captured facts
        </span>
        {facts.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">No structured facts stored.</p>
        ) : (
          <div className="flex flex-col gap-2 text-[13px]">
            {facts.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="capitalize text-on-surface-variant">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-semibold text-on-surface">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
