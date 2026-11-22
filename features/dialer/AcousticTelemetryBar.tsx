'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';
import type { CallState } from '@/services/telephony/types';

interface AcousticTelemetryBarProps {
  onToggleDiagnostics?: () => void;
  showDiagnostics?: boolean;
  campaignName?: string;
  callState?: CallState;
  statusLabel?: string;
  leadName?: string;
}

export const AcousticTelemetryBar: React.FC<AcousticTelemetryBarProps> = ({
  onToggleDiagnostics,
  showDiagnostics,
  campaignName = 'Direct Outbound',
  callState = 'idle',
  statusLabel = 'Ready',
  leadName,
}) => {
  const isConnected = callState === 'connected';

  return (
    <section className="w-full bg-surface px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-border">
      {/* Left: Campaign & Live Status */}
      <div className="flex items-center gap-4 flex-wrap text-[14px]">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected
                ? 'bg-success'
                : callState === 'dialing' || callState === 'ringing'
                ? 'bg-warning'
                : 'bg-on-surface-muted'
            }`}
          />
          <span className="font-semibold text-on-surface">
            {statusLabel}
          </span>
        </div>

        {leadName && (
          <>
            <span className="text-border-strong">•</span>
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span>Lead:</span>
              <span className="text-on-surface font-medium">{leadName}</span>
            </div>
          </>
        )}

        <span className="text-border-strong">•</span>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <span>Calling Schedule:</span>
          <span className="text-on-surface font-medium">{campaignName}</span>
        </div>
      </div>

      {/* Right: Audio Diagnostics Toggle */}
      {onToggleDiagnostics && (
        <button
          onClick={onToggleDiagnostics}
          type="button"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium border transition-colors ${
            showDiagnostics
              ? 'bg-surface-secondary text-on-surface border-border-strong'
              : 'bg-surface text-on-surface-variant hover:text-on-surface border-border hover:bg-surface-elevated'
          }`}
          title="Toggle audio diagnostics"
        >
          <Icon name="tune" size={16} />
          <span>Audio Diagnostics</span>
        </button>
      )}
    </section>
  );
};
