import React from 'react';
import { mockVoiceClones } from '@/lib/mock/settings';

export function VoiceClonesCard() {
  const clones = mockVoiceClones;

  return (
    <div className="bg-surface rounded-xl p-6 shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <span className="text-[16px] font-bold text-on-surface">Registered AI Voices</span>
        <button type="button" className="text-primary hover:underline text-[13px] font-semibold">
          Add Custom Voice
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {clones.map((clone) => (
          <div
            key={clone.id}
            className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated hover:bg-surface-secondary transition-colors border border-border"
          >
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-on-surface">{clone.name}</span>
                <span className="text-[12px] text-on-surface-variant">{clone.description}</span>
              </div>
            </div>
            <span
              className="px-2.5 py-0.5 rounded bg-surface text-[12px] font-medium text-on-surface border border-border"
            >
              {clone.callsToday}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
