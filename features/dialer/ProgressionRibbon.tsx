'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';
import type { CallState } from '@/services/telephony/types';
import type { ConversationState } from '@/services/voice/types';

interface ProgressionRibbonProps {
  callState?: CallState;
  conversationState?: ConversationState;
  agentName?: string;
  durationSeconds?: number;
  embedded?: boolean;
}

export const ProgressionRibbon: React.FC<ProgressionRibbonProps> = ({
  callState = 'idle',
  conversationState = 'idle',
  durationSeconds = 0,
  embedded = false,
}) => {
  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStageInfo = () => {
    switch (callState) {
      case 'idle':
        return {
          label: 'READY',
          desc: 'Standing by to place call',
          badgeBg: 'bg-surface-secondary text-on-surface border-border',
          dotColor: 'bg-on-surface-muted',
          icon: 'circle',
        };
      case 'preparing':
      case 'dialing':
        return {
          label: 'DIALING',
          desc: 'Connecting phone line',
          badgeBg: 'bg-info/15 text-info border-info/30',
          dotColor: 'bg-info',
          icon: 'ring_volume',
        };
      case 'ringing':
        return {
          label: 'RINGING',
          desc: 'Waiting for prospect to answer',
          badgeBg: 'bg-warning/15 text-warning border-warning/30',
          dotColor: 'bg-warning',
          icon: 'bell',
        };
      case 'connected':
        return {
          label: 'CONNECTED',
          desc: 'Live call with prospect',
          badgeBg: 'bg-success-surface text-success border-success/30',
          dotColor: 'bg-success',
          icon: 'call',
        };
      case 'completed':
        return {
          label: 'ENDED',
          desc: 'Call finished — select an outcome',
          badgeBg: 'bg-surface-secondary text-on-surface border-border',
          dotColor: 'bg-on-surface-muted',
          icon: 'check_circle',
        };
      case 'busy':
        return {
          label: 'ENDED',
          desc: 'Prospect line was busy',
          badgeBg: 'bg-error/15 text-error border-error/30',
          dotColor: 'bg-error',
          icon: 'phone_missed',
        };
      case 'no_answer':
        return {
          label: 'ENDED',
          desc: 'Prospect did not answer',
          badgeBg: 'bg-error/15 text-error border-error/30',
          dotColor: 'bg-error',
          icon: 'phone_missed',
        };
      case 'failed':
      default:
        return {
          label: 'FAILED',
          desc: 'Could not establish connection',
          badgeBg: 'bg-error/15 text-error border-error/30',
          dotColor: 'bg-error',
          icon: 'error',
        };
    }
  };

  const stage = getStageInfo();
  const isConnected = callState === 'connected';

  const getConversationStatus = () => {
    if (!isConnected) return null;
    switch (conversationState) {
      case 'ai_speaking':
        return { text: 'AI Speaking', bg: 'bg-accent-surface text-primary border-primary/20' };
      case 'prospect_speaking':
        return { text: 'Prospect Speaking', bg: 'bg-surface-elevated text-on-surface border-border' };
      case 'processing':
        return { text: 'AI Thinking...', bg: 'bg-surface-elevated text-on-surface-variant border-border' };
      case 'interrupted':
        return { text: 'Prospect Interrupted', bg: 'bg-warning/15 text-warning border-warning/30' };
      case 'listening':
      default:
        return { text: 'AI Listening', bg: 'bg-accent-surface text-secondary border-secondary/20' };
    }
  };

  const convStatus = getConversationStatus();

  return (
    <div className={embedded ? 'flex w-full flex-col gap-3 border-b border-border p-4' : 'flex w-full flex-col gap-3 rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#121614]'}>
      {/* Call Stage Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[14px] font-semibold ${stage.badgeBg}`}>
            <Icon name={stage.icon} size={18} />
            <span>{stage.label}</span>
          </div>
          <span className="text-[13px] text-on-surface-variant">{stage.desc}</span>
        </div>

        {/* Timer & Conversation State */}
        <div className="flex items-center gap-3">
          {convStatus && (
            <span className={`px-2.5 py-1 rounded text-[12px] font-medium border ${convStatus.bg}`}>
              {convStatus.text}
            </span>
          )}
          <div
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-semibold tabular-nums transition-all duration-200 ${
              isConnected
                ? 'border-success/30 bg-success-surface text-[20px] text-success'
                : 'border-border bg-surface-elevated text-[14px] text-on-surface'
            }`}
          >
            <Icon name="timer" size={isConnected ? 18 : 16} className={isConnected ? 'text-success' : 'text-on-surface-variant'} />
            <span>{formatTimer(durationSeconds)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
