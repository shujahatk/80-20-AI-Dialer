'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export const LiveVoiceSandbox: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [payload, setPayload] = useState({
    prospect: 'David Chen (COO)',
    company: 'Logistics Partner NV',
    fleetSize: '250 Tonnes/Mo',
    competitor: 'Current Contractor',
  });

  const toggleRecording = () => {
    setIsRecording((prev) => !prev);
  };

  return (
    <div className="rounded-xl bg-surface p-5 flex flex-col gap-4 shadow-sm border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="mic" size={20} className="text-primary" />
          <h2 className="text-[15px] font-bold text-on-surface">
            Live Voice Test Sandbox
          </h2>
        </div>
        <span className="text-[12px] font-semibold text-on-surface-variant px-2 py-0.5 rounded bg-surface-secondary border border-border">
          Audio Test
        </span>
      </div>

      {/* Voice Status */}
      <div className="rounded-lg bg-surface-secondary p-4 flex flex-col items-center justify-center text-center border border-border">
        <span className="text-[13px] font-semibold text-on-surface">
          {isRecording ? 'Listening to your microphone...' : 'Ready to test voice responses'}
        </span>
        <span className="text-[12px] text-on-surface-variant mt-0.5">
          Speak with the AI agent using your browser microphone
        </span>

        {/* Speak Action Button */}
        <div className="pt-4">
          <button
            onClick={toggleRecording}
            className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-[14px] font-semibold shadow-sm transition-colors ${
              isRecording
                ? 'bg-error text-white hover:bg-error/90'
                : 'bg-primary text-on-primary hover:bg-primary-hover'
            }`}
            type="button"
          >
            <Icon name={isRecording ? 'mic_off' : 'mic'} size={18} />
            <span>{isRecording ? 'Stop Test' : 'Start Microphone Test'}</span>
          </button>
        </div>
      </div>

      {/* Test Lead Context */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border text-[13px]">
        <span className="font-semibold text-on-surface">Test Context:</span>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="p-2 rounded bg-surface-secondary border border-border">
            <span className="text-on-surface-variant block">Contact</span>
            <span className="text-on-surface font-semibold">{payload.prospect}</span>
          </div>
          <div className="p-2 rounded bg-surface-secondary border border-border">
            <span className="text-on-surface-variant block">Company</span>
            <span className="text-on-surface font-semibold">{payload.company}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
