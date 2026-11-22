'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';

interface TrunkSpectrumVisualizerProps {
  activeChannels?: number;
  maxChannels?: number;
  twilioLatency?: string;
  voiceGenLatency?: string;
}

export const TrunkSpectrumVisualizer: React.FC<TrunkSpectrumVisualizerProps> = ({
  activeChannels = 28,
  maxChannels = 50,
  twilioLatency = '38ms Jitter-free',
  voiceGenLatency = '240ms P95',
}) => {
  const bars = [
    { h: 'h-10', color: 'bg-secondary' },
    { h: 'h-6', color: 'bg-accent' },
    { h: 'h-14', color: 'bg-primary' },
    { h: 'h-12', color: 'bg-secondary' },
    { h: 'h-8', color: 'bg-accent' },
    { h: 'h-16', color: 'bg-primary' },
    { h: 'h-12', color: 'bg-secondary' },
    { h: 'h-6', color: 'bg-accent' },
    { h: 'h-12', color: 'bg-primary' },
    { h: 'h-16', color: 'bg-primary' },
    { h: 'h-10', color: 'bg-secondary' },
    { h: 'h-8', color: 'bg-accent' },
    { h: 'h-12', color: 'bg-secondary' },
    { h: 'h-14', color: 'bg-primary' },
    { h: 'h-10', color: 'bg-accent' },
    { h: 'h-8', color: 'bg-accent' },
    { h: 'h-12', color: 'bg-secondary' },
    { h: 'h-10', color: 'bg-accent' },
    { h: 'h-6', color: 'bg-surface-secondary' },
    { h: 'h-10', color: 'bg-secondary' },
    { h: 'h-4', color: 'bg-surface-secondary' },
    { h: 'h-3', color: 'bg-surface-secondary' },
    { h: 'h-3', color: 'bg-surface-secondary' },
    { h: 'h-3', color: 'bg-surface-secondary' },
    { h: 'h-3', color: 'bg-surface-secondary' },
    { h: 'h-3', color: 'bg-surface-secondary' },
    { h: 'h-3', color: 'bg-surface-secondary' },
    { h: 'h-3', color: 'bg-surface-secondary' },
  ];

  return (
    <div className="p-4 rounded-xl bg-surface shadow-sm flex flex-col gap-3 border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="graphic_eq" size={18} className="text-primary" />
          <span className="text-[14px] font-bold text-on-surface">
            Active Line Spectrum
          </span>
        </div>
        <span className="text-[12px] text-success font-semibold bg-surface-elevated px-2 py-0.5 rounded border border-border">
          {activeChannels} / {maxChannels} Lines Active
        </span>
      </div>

      {/* Dynamic Wave Visualizer for Concurrency */}
      <div className="w-full h-16 bg-surface-elevated rounded-lg p-2 flex items-end justify-between gap-1 overflow-hidden border border-border">
        {bars.map((bar, idx) => (
          <div
            key={idx}
            className={`w-full ${bar.h} ${bar.color} rounded-t-sm transition-all duration-200`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex flex-col bg-surface-elevated p-2 rounded-lg border border-border">
          <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
            Carrier Latency
          </span>
          <span className="text-[13px] font-bold text-primary">
            {twilioLatency}
          </span>
        </div>
        <div className="flex flex-col bg-surface-elevated p-2 rounded-lg border border-border">
          <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
            Synthesis Latency
          </span>
          <span className="text-[13px] font-bold text-primary">
            {voiceGenLatency}
          </span>
        </div>
      </div>
    </div>
  );
};
