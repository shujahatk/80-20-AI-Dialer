import React from 'react';
import { mockVoiceProsody } from '@/lib/mock/analytics';
import { Icon } from '@/lib/ui/icons';

export function VoiceProsodyCard() {
  const prosody = mockVoiceProsody;

  return (
    <div className="bg-surface p-6 rounded-xl shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Icon name="graphic_eq" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">Voice Quality &amp; Acoustic Accuracy</h2>
          </div>
          <span className="text-[13px] text-on-surface-variant">Prosody metrics &amp; speech-to-text fidelity</span>
        </div>
        <div className="flex items-center gap-1 bg-surface-elevated px-2.5 py-1 rounded border border-border">
          <span className="text-[12px] text-on-surface-variant uppercase font-semibold">WER</span>
          <span className="text-[13px] text-primary font-bold">{prosody.wer}</span>
        </div>
      </div>

      {/* Sentiment Distribution Spectrum */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-on-surface font-medium">Prospect Acoustic Prosody</span>
          <span className="text-[13px] text-success font-bold">88% Non-Hostile</span>
        </div>
        <div className="h-2.5 w-full bg-surface-secondary rounded-full flex overflow-hidden">
          <div className="h-full bg-success" style={{ width: `${prosody.receptive}%` }} title={`Receptive ${prosody.receptive}%`} />
          <div className="h-full bg-secondary" style={{ width: `${prosody.neutral}%` }} title={`Neutral ${prosody.neutral}%`} />
          <div className="h-full bg-error" style={{ width: `${prosody.defensive}%` }} title={`Defensive ${prosody.defensive}%`} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[12px] mt-1">
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-success font-bold">
              <span className="w-2 h-2 rounded-full bg-success" /> {prosody.receptive}%
            </span>
            <span className="text-on-surface-variant">Receptive / Curious</span>
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-primary font-bold">
              <span className="w-2 h-2 rounded-full bg-primary" /> {prosody.neutral}%
            </span>
            <span className="text-on-surface-variant">Neutral / Analytical</span>
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-error font-bold">
              <span className="w-2 h-2 rounded-full bg-error" /> {prosody.defensive}%
            </span>
            <span className="text-on-surface-variant">Hostile / Defensive</span>
          </div>
        </div>
      </div>

      {/* Acoustic Pipeline Status Strip */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-surface-elevated p-3 rounded-lg flex flex-col border border-border">
          <span className="text-[11px] text-on-surface-variant uppercase font-semibold">Background Noise Suppression</span>
          <span className="text-[15px] text-on-surface font-bold mt-1">{prosody.snr}</span>
          <span className="text-[12px] text-success font-medium mt-0.5">Filter Active</span>
        </div>
        <div className="bg-surface-elevated p-3 rounded-lg flex flex-col border border-border">
          <span className="text-[11px] text-on-surface-variant uppercase font-semibold">Interruption Token Sync</span>
          <span className="text-[15px] text-on-surface font-bold mt-1">{prosody.cutoffMs}</span>
          <span className="text-[12px] text-success font-medium mt-0.5">Zero Human-AI Collision</span>
        </div>
      </div>
    </div>
  );
}
