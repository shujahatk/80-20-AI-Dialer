'use client';

import React from 'react';
import { mockCallOutcomes } from '@/lib/mock/analytics';
import { Icon } from '@/lib/ui/icons';

export function CallOutcomesCard() {
  const totalCalls = mockCallOutcomes.reduce((acc, curr) => acc + curr.count, 0);

  // Map outcome styles to clean RM semantic palette
  const outcomeColors: Record<string, { bar: string; dot: string; text: string }> = {
    Qualified: { bar: 'bg-success', dot: 'bg-success', text: 'text-success' },
    'Meeting Booked': { bar: 'bg-primary', dot: 'bg-primary', text: 'text-primary' },
    'Follow-up Needed': { bar: 'bg-warning', dot: 'bg-warning', text: 'text-warning' },
    'Gatekeeper / Voicemail': { bar: 'bg-info', dot: 'bg-info', text: 'text-info' },
    'Not Interested': { bar: 'bg-error', dot: 'bg-error', text: 'text-error' },
    'DNC Requested': { bar: 'bg-on-surface-variant', dot: 'bg-on-surface-variant', text: 'text-on-surface-variant' },
  };

  return (
    <div className="bg-surface p-6 rounded-xl shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Icon name="pie_chart" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">Call Outcomes</h2>
          </div>
          <span className="text-[13px] text-on-surface-variant">
            Distribution across {totalCalls.toLocaleString()} logged calls
          </span>
        </div>
      </div>

      {/* Visual Stacked Linear Progress Bar */}
      <div className="w-full h-3 bg-surface-secondary rounded-full overflow-hidden flex">
        {mockCallOutcomes.map((item) => {
          const style = outcomeColors[item.outcome] || { bar: 'bg-secondary' };
          return (
            <div
              key={item.outcome}
              className={`h-full ${style.bar}`}
              style={{ width: `${item.percent}%` }}
              title={`${item.outcome}: ${item.count} (${item.percent}%)`}
            />
          );
        })}
      </div>

      {/* Detailed Outcome Rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {mockCallOutcomes.map((item) => {
          const style = outcomeColors[item.outcome] || { dot: 'bg-secondary', text: 'text-on-surface' };
          return (
            <div
              key={item.outcome}
              className="flex items-center justify-between p-2.5 px-3 rounded-lg bg-surface-elevated hover:bg-surface-secondary transition-colors border border-border"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                <span className="text-[14px] text-on-surface font-medium">{item.outcome}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] text-on-surface font-bold">
                  {item.count.toLocaleString()}
                </span>
                <span className={`text-[12px] font-semibold ${style.text}`}>
                  ({item.percent}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
