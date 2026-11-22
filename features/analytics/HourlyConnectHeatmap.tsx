import React from 'react';
import { mockHeatmapMatrix } from '@/lib/mock/analytics';
import { Icon } from '@/lib/ui/icons';

export function HourlyConnectHeatmap() {
  const days = mockHeatmapMatrix;

  const hours = [
    '08:00',
    '09:00',
    '10:00*',
    '11:00*',
    '12:00',
    '13:00',
    '14:00*',
    '15:00*',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
  ];

  const getCellColor = (rate: number, isPeak?: boolean) => {
    if (isPeak || rate >= 18) {
      return 'bg-primary text-on-primary font-bold';
    }
    if (rate >= 14) return 'bg-secondary text-on-secondary';
    if (rate >= 10) return 'bg-accent/40 text-on-surface';
    if (rate >= 7) return 'bg-surface-secondary text-on-surface-variant';
    return 'bg-surface-elevated text-on-surface-muted';
  };

  return (
    <div className="bg-surface p-6 rounded-xl shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Icon name="schedule" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">
              Connect Rate by Day &amp; Hour
            </h2>
          </div>
          <span className="text-[13px] text-on-surface-variant">
            Lead response distribution across calling schedule
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-surface-elevated border border-border" /> Low (&lt;8%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-accent/40" /> Normal (9-14%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-primary" /> Peak (18%+)
          </span>
        </div>
      </div>

      {/* The Matrix Grid */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[620px] flex flex-col gap-1.5">
          {/* Hour Markers Header */}
          <div className="grid grid-cols-13 gap-1 items-center text-[12px] text-on-surface-variant text-center pb-1 font-semibold">
            <div className="text-left pl-1">DAY</div>
            {hours.map((h) => (
              <div key={h} className={h.includes('*') ? 'text-primary font-bold' : ''}>
                {h}
              </div>
            ))}
          </div>

          {/* Weekday & Weekend Rows */}
          {days.map((d) => {
            if (d.autoPaused) {
              return (
                <div key={d.day} className="grid grid-cols-13 gap-1 items-center text-center opacity-60 text-[13px]">
                  <span className="text-left pl-1 text-on-surface-variant font-medium">{d.day}</span>
                  <div className="h-6 rounded bg-surface-elevated col-span-12 flex items-center justify-center text-on-surface-muted text-[12px] border border-border">
                    Outside Calling Hours — Compliant Window Active
                  </div>
                </div>
              );
            }

            return (
              <div key={d.day} className="grid grid-cols-13 gap-1 items-center text-center text-[13px]">
                <span className="text-left pl-1 text-on-surface-variant font-semibold">
                  {d.day}
                </span>
                {d.slots.map((slot, sIdx) => {
                  const showLabel = slot.isPeak || slot.rate >= 18;
                  return (
                    <div
                      key={sIdx}
                      className={`h-6 rounded text-[11px] flex items-center justify-center transition-colors border border-border ${getCellColor(
                        slot.rate,
                        slot.isPeak
                      )}`}
                      title={`${d.day} ${slot.hour}: ${slot.rate}% connect rate`}
                    >
                      {showLabel ? `${slot.rate}%` : ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
