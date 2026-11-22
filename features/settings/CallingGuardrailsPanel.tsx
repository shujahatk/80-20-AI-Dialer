'use client';

import React, { useState } from 'react';
import { mockTelephonyGuardrails } from '@/lib/mock/settings';
import { Icon } from '@/lib/ui/icons';

export function CallingGuardrailsPanel() {
  const [trunkLimit, setTrunkLimit] = useState(mockTelephonyGuardrails.activeTrunks);
  const [timezoneFilter, setTimezoneFilter] = useState(mockTelephonyGuardrails.enforceTimezoneFilter);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface rounded-xl p-6 shadow-sm flex flex-col gap-5 border border-border">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-on-primary">
              <Icon name="shield" size={18} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-on-surface">
                Calling Rules &amp; Working Hours
              </h2>
              <p className="text-[13px] text-on-surface-variant">
                Simultaneous dialing limits and timezone compliance
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-success-surface text-success text-[12px] font-semibold border border-success/20">
            Compliant
          </span>
        </div>

        {/* Simultaneous Call Limit Slider */}
        <div className="flex flex-col gap-2 bg-surface-elevated p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <label className="text-[14px] font-semibold text-on-surface" htmlFor="trunkSlider">
                Simultaneous Dialing Limit
              </label>
              <span className="text-[13px] text-on-surface-variant">
                Maximum parallel outbound calls placed at one time
              </span>
            </div>
            <div className="flex items-baseline gap-1 bg-surface px-3 py-1 rounded-md border border-border">
              <span className="text-[16px] font-bold text-primary">{trunkLimit}</span>
              <span className="text-[12px] text-on-surface-variant">/ 50 lines</span>
            </div>
          </div>

          <input
            id="trunkSlider"
            type="range"
            min="1"
            max="50"
            value={trunkLimit}
            onChange={(e) => setTrunkLimit(Number(e.target.value))}
            className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none mt-2"
          />

          <div className="flex justify-between items-center text-on-surface-variant text-[12px] pt-1">
            <span>1 Line (Single call)</span>
            <span className="text-primary font-semibold">{trunkLimit} Active Lines</span>
            <span>50 Lines (Full team)</span>
          </div>
        </div>

        {/* Calling Hours & Timezone Policy */}
        <div className="flex items-start justify-between gap-4 p-4 bg-surface-elevated rounded-lg border border-border">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-md bg-surface-secondary flex items-center justify-center text-on-surface shrink-0 mt-0.5">
              <Icon name="schedule" size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-on-surface">Calling Hours &amp; Timezone Filter</span>
              <span className="text-[13px] text-on-surface-variant">
                Restrict outbound calling to 09:00 - 17:30 in the prospect&apos;s local timezone.
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded bg-surface text-primary text-[12px] font-medium border border-border">
                  09:00 - 17:30 CET
                </span>
                <span className="px-2 py-0.5 rounded bg-surface text-on-surface-variant text-[12px] border border-border">
                  Excludes Belgian National Holidays
                </span>
              </div>
            </div>
          </div>

          {/* Toggle */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={timezoneFilter}
              onChange={(e) => setTimezoneFilter(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-secondary rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>
      </div>
    </div>
  );
}
