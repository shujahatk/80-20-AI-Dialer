'use client';

import React from 'react';
import { primaryAnalyticsKpis } from '@/lib/mock/analytics';
import { Icon } from '@/lib/ui/icons';

export function AnalyticsKpiGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {primaryAnalyticsKpis.map((kpi) => {
        const isUp = kpi.trend === 'up';
        return (
          <div
            key={kpi.label}
            className="bg-surface p-4 rounded-xl shadow-sm flex flex-col justify-between border border-border"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-on-surface-variant uppercase truncate" title={kpi.label}>
                {kpi.label}
              </span>
              <Icon name={kpi.icon} size={18} className="text-primary" />
            </div>

            <div>
              <div className="text-[20px] font-bold text-on-surface tracking-tight">
                {kpi.value}
              </div>
              <div className="flex items-center gap-1 mt-1 text-[12px]">
                {isUp ? (
                  <span className="text-success flex items-center font-semibold">
                    <Icon name="arrow_upward" size={14} />
                    {kpi.change}
                  </span>
                ) : (
                  <span className="text-on-surface-variant font-medium">
                    {kpi.change}
                  </span>
                )}
                <span className="text-on-surface-muted truncate ml-1">
                  {kpi.subtext}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
