'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';
import type { CallState } from '@/services/telephony/types';

interface AudioVisualizerProps {
  operatorName?: string;
  leadName?: string;
  callState?: CallState;
  micVolume?: number;
  remoteVolume?: number;
  isMuted?: boolean;
  embedded?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  operatorName = 'Operator',
  leadName = 'Lead Contact',
  callState = 'idle',
  micVolume = 0,
  remoteVolume = 0,
  isMuted = false,
  embedded = false,
}) => {
  const isConnected = callState === 'connected';
  const isDialing = callState === 'dialing' || callState === 'ringing';

  return (
    <div className={embedded ? 'flex min-h-[220px] flex-1 flex-col items-center justify-between px-5 py-4' : 'rm-card flex min-h-[260px] flex-col items-center justify-between p-6'}>
      {/* Top Header Identity Strip */}
      <div className={`w-full flex items-center ${embedded ? 'justify-center' : 'justify-between'}`}>
        {/* Operator Identity */}
        {!embedded && (
        <div className="flex items-center gap-3 bg-surface-elevated px-3.5 py-2 rounded-lg border border-border">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
            <Icon name="headset_mic" size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold text-on-surface leading-tight">
              {operatorName}
            </span>
            <span className="text-[12px] text-on-surface-variant">
              {isMuted ? 'Muted' : 'Operator (Ready)'}
            </span>
          </div>
        </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated text-on-surface border border-border text-[13px] font-medium">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected
                ? 'bg-success'
                : isDialing
                ? 'bg-warning'
                : 'bg-on-surface-muted'
            }`}
          />
          <span>
            {isConnected
              ? 'Audio Connected'
              : isDialing
              ? 'Connecting Audio...'
              : 'Standby'}
          </span>
        </div>

        {/* Prospect Identity */}
        {!embedded && (
        <div className="flex items-center gap-3 bg-surface-elevated px-3.5 py-2 rounded-lg border border-border">
          <div className="flex flex-col text-right">
            <span className="text-[14px] font-semibold text-on-surface leading-tight">
              {leadName}
            </span>
            <span className="text-[12px] text-on-surface-variant">
              Prospect
            </span>
          </div>
          <div className="w-8 h-8 rounded-md bg-surface-secondary text-on-surface flex items-center justify-center">
            <Icon name="person" size={18} />
          </div>
        </div>
        )}
      </div>

      {/* Restrained Audio Volume Levels */}
      {!isConnected && !isDialing ? (
        <div className="my-auto flex max-w-sm flex-col items-center gap-1 py-6 text-center">
          <span className="text-[13px] font-medium text-on-surface">Voice channel idle</span>
          <span className="text-[12px] text-on-surface-variant">Microphone and prospect meters appear when a call is placed.</span>
        </div>
      ) : (
      <div className="w-full my-auto flex flex-col gap-5 py-4 max-w-lg">
        {/* Operator Volume Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[13px] text-on-surface-variant">
            <span className="font-medium text-on-surface">Operator Microphone</span>
            <span>{isMuted ? 'Muted' : `${micVolume}%`}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface-secondary overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                isMuted ? 'bg-error' : 'bg-primary'
              }`}
              style={{ width: `${isMuted ? 0 : Math.min(100, Math.max(0, micVolume))}%` }}
            />
          </div>
        </div>

        {/* Prospect Volume Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[13px] text-on-surface-variant">
            <span className="font-medium text-on-surface">Incoming Prospect Audio</span>
            <span>{isConnected ? `${remoteVolume}%` : '0%'}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface-secondary overflow-hidden">
            <div
              className="h-full bg-secondary transition-all duration-100"
              style={{ width: `${isConnected ? Math.min(100, Math.max(0, remoteVolume)) : 0}%` }}
            />
          </div>
        </div>
      </div>
      )}

      {/* Footer Info */}
      <div className="w-full flex items-center justify-between text-[12px] text-on-surface-muted pt-3 border-t border-border">
        <span>Browser voice channel</span>
        <span>{isConnected ? 'Live audio' : 'Standby'}</span>
      </div>
    </div>
  );
};
