import React from 'react';
import { mockAnalyticsFunnel } from '@/lib/mock/analytics';
import { Icon } from '@/lib/ui/icons';

export function ConversationalFunnel() {
  const stages = mockAnalyticsFunnel;

  return (
    <div className="bg-surface p-6 rounded-xl shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Icon name="filter_alt" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">
              Qualification Funnel
            </h2>
          </div>
          <span className="text-[13px] text-on-surface-variant">
            Lead progression through conversation stages across 12,480 calls
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-elevated px-3 py-1 rounded-md text-[13px] text-primary border border-border font-semibold">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span>Conversion Rate: 14.4%</span>
        </div>
      </div>

      {/* Multi-tier Visual Funnel */}
      <div className="flex flex-col gap-2.5 mt-1">
        {stages.map((stage) => {
          const isFinalGoal = stage.stageNumber === 5;

          if (isFinalGoal) {
            return (
              <div
                key={stage.stageNumber}
                className="flex flex-col gap-1.5 bg-accent-surface p-3 rounded-lg border border-secondary/30"
              >
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-primary font-bold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[12px] font-bold">
                      {stage.stageNumber}
                    </span>
                    {stage.stageName}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-[14px] text-primary font-bold">
                      {stage.count.toLocaleString()} meetings
                    </span>
                    <span className="text-[12px] text-on-primary bg-primary px-2 py-0.5 rounded font-bold">
                      {stage.conversionPercent}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${stage.barPercent}%` }}
                  />
                </div>
              </div>
            );
          }

          return (
            <div
              key={stage.stageNumber}
              className="flex flex-col gap-1.5 bg-surface-elevated p-3 rounded-lg hover:bg-surface-secondary transition-colors border border-border"
            >
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-on-surface font-medium flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-secondary text-primary flex items-center justify-center text-[12px] font-bold">
                    {stage.stageNumber}
                  </span>
                  {stage.stageName}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-[14px] text-on-surface font-semibold">
                    {stage.count.toLocaleString()} calls
                  </span>
                  <span className="text-[12px] font-semibold bg-surface-secondary text-primary px-2 py-0.5 rounded">
                    {stage.conversionPercent}%
                  </span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    stage.stageNumber === 4
                      ? 'bg-secondary'
                      : stage.stageNumber === 3
                      ? 'bg-accent'
                      : stage.stageNumber === 2
                      ? 'bg-secondary/80'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${stage.barPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Recommendation */}
      <div className="flex flex-wrap items-center justify-between pt-2 bg-surface-elevated p-3 rounded-lg text-on-surface-variant text-[13px] border border-border">
        <span>Biggest drop occurs between Opener and Discovery (-33.8%)</span>
        <span className="text-primary font-semibold">Recommendation: Shorten opening pitch to engage sooner</span>
      </div>
    </div>
  );
}
