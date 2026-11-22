import React from 'react';
import { mockObjectionsMatrix } from '@/lib/mock/analytics';
import { Icon } from '@/lib/ui/icons';

export function ObjectionsMatrixCard() {
  const objections = mockObjectionsMatrix;

  return (
    <div className="bg-surface p-6 rounded-xl shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Icon name="psychology_alt" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">Objections &amp; Resolution Patterns</h2>
          </div>
          <span className="text-[13px] text-on-surface-variant">Response pathing &amp; successful handling rate</span>
        </div>
        <span className="text-[12px] bg-surface-elevated px-2.5 py-1 rounded text-primary border border-border font-semibold">
          604 Logged
        </span>
      </div>

      {/* Table / List of Objections */}
      <div className="flex flex-col gap-2">
        {objections.map((item, idx) => {
          const label = item.navigatedPercent === 82 ? 'Routed' : 'Resolved';

          return (
            <div key={idx} className="flex flex-col gap-1.5 bg-surface-elevated p-3 rounded-lg hover:bg-surface-secondary transition-colors border border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[14px] text-on-surface font-semibold">{item.objection}</span>
                  <span className="text-[12px] text-on-surface-variant">
                    Detected in {item.detectedCalls} calls • {item.frequency} frequency
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[14px] text-primary font-bold">
                    {item.navigatedPercent}% {label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${item.navigatedPercent}%` }}
                  />
                </div>
                <span className="text-[12px] text-on-surface-variant font-mono font-medium">
                  {item.rebuttalCode}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
