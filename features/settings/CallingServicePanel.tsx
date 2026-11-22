'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export function CallingServicePanel() {
  const [channels, setChannels] = useState(50);
  const [callerId, setCallerId] = useState('+1 (415) 890-2341');
  const [recordingMode, setRecordingMode] = useState<'dual_channel' | 'mono' | 'disabled'>('dual_channel');
  const [jitterBufferMs, setJitterBufferMs] = useState(40);
  const [sipEndpoint, setSipEndpoint] = useState('sip:trunk-us-east.rmdialer.com');

  return (
    <div className="flex flex-col gap-6">
      {/* Telephony SIP Trunk Config */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="phone_in_talk" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Twilio Voice &amp; SIP Trunk Configuration</h2>
              <p className="text-xs text-on-surface-variant">
                Configure carrier PSTN connectivity, concurrent trunk lines, and caller ID routing.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-surface-secondary text-on-surface-variant text-xs font-semibold border border-border">
            Environment-managed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Default Outbound Caller ID Pool</label>
            <select
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="+1 (415) 890-2341">+1 (415) 890-2341 (San Francisco, CA)</option>
              <option value="+1 (212) 555-0144">+1 (212) 555-0144 (New York, NY)</option>
              <option value="+32 2 555 0199">+32 2 555 0199 (Brussels, Belgium)</option>
              <option value="+44 20 7946 0912">+44 20 7946 0912 (London, UK)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">SIP Signaling Gateway Endpoint</label>
            <input
              type="text"
              value={sipEndpoint}
              onChange={(e) => setSipEndpoint(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border font-mono text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Channels Slider */}
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-elevated border border-border">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-on-surface">Concurrent Trunk Channel Limit</span>
              <p className="text-xs text-on-surface-variant">Maximum simultaneous active outbound call legs.</p>
            </div>
            <div className="px-3 py-1 rounded bg-surface border border-border text-sm font-bold text-primary font-mono">
              {channels} Channels
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={channels}
            onChange={(e) => setChannels(Number(e.target.value))}
            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary mt-2"
          />
          <div className="flex justify-between text-xs text-on-surface-variant pt-1 font-mono">
            <span>1 Channel</span>
            <span>50 Standard</span>
            <span>100 Enterprise Max</span>
          </div>
        </div>
      </div>

      {/* Audio Recording & Stream Protocol */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="graphic_eq" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Audio Recording &amp; Jitter Optimization</h2>
              <p className="text-xs text-on-surface-variant">
                Dual-channel separation for automated transcription and acoustic telemetry.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Audio Recording Channel Protocol</label>
            <select
              value={recordingMode}
              onChange={(e) => setRecordingMode(e.target.value as any)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="dual_channel">Dual-Channel Stereo (Agent Left, Prospect Right)</option>
              <option value="mono">Single-Channel Mixed Mono</option>
              <option value="disabled">Disabled (Do Not Record)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Acoustic Jitter Buffer Target</label>
            <select
              value={jitterBufferMs}
              onChange={(e) => setJitterBufferMs(Number(e.target.value))}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value={20}>20ms Ultra-Low Latency (Fast fiber routes)</option>
              <option value={40}>40ms Standard Dynamic (Recommended)</option>
              <option value={80}>80ms High-Stability (Resistant to packet loss)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
