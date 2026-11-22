'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export function WorkingHoursPanel() {
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('17:30');
  const [autoTimezoneDetection, setAutoTimezoneDetection] = useState(true);
  const [blockWeekends, setBlockWeekends] = useState(true);
  const [blockHolidays, setBlockHolidays] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(4);
  const [maxAttempts, setMaxAttempts] = useState(4);

  return (
    <div className="flex flex-col gap-6">
      {/* TCPA & Working Hours Window */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="schedule" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Outbound Dialing Hours &amp; TCPA Compliance</h2>
              <p className="text-xs text-on-surface-variant">
                Enforce legal and respectful calling hours in the prospect&apos;s local timezone.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-semibold border border-success/20">
            TCPA Guard Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Daily Dialing Start Window</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Daily Dialing Cutoff Window</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Dynamic Area Code Timezone Detection */}
        <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-on-surface">Dynamic Recipient Timezone Mapping</span>
            <p className="text-xs text-on-surface-variant">
              Automatically calculates prospect local time from area codes and zip codes to prevent early/late calls.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={autoTimezoneDetection}
              onChange={(e) => setAutoTimezoneDetection(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
      </div>

      {/* Weekend & Holiday Dialing Guards */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="event_busy" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Weekend &amp; Holiday Suppression</h2>
              <p className="text-xs text-on-surface-variant">
                Automatically pause automated outbound campaigns during non-business days.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-on-surface">Block Saturday &amp; Sunday Dialing</span>
              <p className="text-xs text-on-surface-variant">
                Suspends outbound campaigns automatically on weekends.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={blockWeekends}
                onChange={(e) => setBlockWeekends(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-on-surface">National &amp; Bank Holiday Lock</span>
              <p className="text-xs text-on-surface-variant">
                Suppresses calling during US, UK, and EU statutory public holidays.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={blockHolidays}
                onChange={(e) => setBlockHolidays(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        </div>

        {/* Pacing Cooldown & Max Attempts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Minimum Re-Attempt Cooldown</span>
              <span className="text-xs font-mono font-bold text-primary">{cooldownHours} Hours</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-xs text-on-surface-variant">
              Prevents dialing the same lead multiple times in the same day.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Max Lifetime Attempts Per Lead</span>
              <span className="text-xs font-mono font-bold text-primary">{maxAttempts} Attempts</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-xs text-on-surface-variant">
              Automatically moves lead to &apos;Exhausted&apos; disposition after maximum attempts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
