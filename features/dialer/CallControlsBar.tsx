'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';
import { DtmfKeypad } from './DtmfKeypad';

interface CallControlsBarProps {
  onHangup?: () => void;
  onMuteToggle?: () => void;
  isMuted?: boolean;
  onPauseAiToggle?: (isPaused: boolean) => void;
  onOutcomeSelect?: (outcome: string) => void;
  onSendDtmf?: (digit: string) => void;
  isCallActive?: boolean;
  embedded?: boolean;
}

export const CallControlsBar: React.FC<CallControlsBarProps> = ({
  onHangup,
  onMuteToggle,
  isMuted = false,
  onPauseAiToggle,
  onOutcomeSelect,
  onSendDtmf,
  isCallActive = false,
  embedded = false,
}) => {
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState('qualified');

  const toggleAi = () => {
    const next = !isAiPaused;
    setIsAiPaused(next);
    onPauseAiToggle?.(next);
  };

  const outcomes = [
    { id: 'qualified', label: 'Qualified' },
    { id: 'callback', label: 'Callback Requested' },
    { id: 'appointment', label: 'Appointment Booked' },
    { id: 'interested', label: 'Interested / Send Info' },
    { id: 'not_interested', label: 'Not Interested' },
    { id: 'wrong_contact', label: 'Wrong Contact' },
    { id: 'dnc', label: 'Do Not Call (DNC)' },
  ];

  return (
    <div className={embedded ? 'flex flex-col gap-4 border-t border-border bg-surface-elevated/60 p-4' : 'rm-card flex flex-col gap-4 p-5'}>
      {/* Primary Action Buttons Row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mute Button */}
          <button
            onClick={onMuteToggle}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-colors border ${
              isMuted
                ? 'bg-error/15 text-error border-error/40'
                : 'bg-surface-elevated text-on-surface hover:bg-surface-secondary border-border'
            }`}
            type="button"
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            <Icon name={isMuted ? 'mic_off' : 'mic'} size={18} />
            <span>{isMuted ? 'Muted' : 'Mute'}</span>
          </button>

          {/* Keypad Toggle Button */}
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-colors border ${
              showKeypad
                ? 'bg-accent-surface text-primary border-primary'
                : 'bg-surface-elevated text-on-surface hover:bg-surface-secondary border-border'
            }`}
            type="button"
            title="Open phone keypad"
          >
            <Icon name="dialpad" size={18} />
            <span>Keypad</span>
          </button>

          {/* Pause AI Button */}
          <button
            onClick={toggleAi}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-colors border ${
              isAiPaused
                ? 'bg-warning/15 text-warning border-warning/40'
                : 'bg-surface-elevated text-on-surface hover:bg-surface-secondary border-border'
            }`}
            type="button"
            title={isAiPaused ? 'Resume AI Agent' : 'Pause AI Agent'}
          >
            <Icon name={isAiPaused ? 'play_arrow' : 'pause'} size={18} />
            <span>{isAiPaused ? 'Resume AI' : 'Pause AI'}</span>
          </button>
        </div>

        {/* End Call Button */}
        {isCallActive && (
          <button
            onClick={onHangup}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-error hover:opacity-90 text-white font-semibold text-[14px] transition-colors shadow-sm"
            type="button"
          >
            <Icon name="call_end" size={18} />
            <span>End Call</span>
          </button>
        )}
      </div>

      {/* DTMF Keypad Drawer */}
      {showKeypad && (
        <div className="pt-3 border-t border-border">
          <DtmfKeypad onSendDtmf={(tone: string) => onSendDtmf?.(tone)} />
        </div>
      )}

      {/* Call Outcome Selector Strip */}
      <div className="pt-3 border-t border-border flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-on-surface-variant uppercase tracking-wider">
          Call Outcome
        </span>
        <div className="flex flex-wrap gap-2">
          {outcomes.map((item) => {
            const isSelected = selectedOutcome === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedOutcome(item.id);
                  onOutcomeSelect?.(item.id);
                }}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-surface-elevated text-on-surface hover:bg-surface-secondary border-border'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
