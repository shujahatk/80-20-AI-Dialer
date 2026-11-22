'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export const QuickTestSimulator: React.FC = () => {
  const [targetAgent, setTargetAgent] = useState('Rachel • Enterprise Logistics Outreach');
  const [destinationNumber, setDestinationNumber] = useState('+1 (415) 890-2211');
  const [isCalling, setIsCalling] = useState(false);

  const handleDispatchTest = () => {
    setIsCalling(true);
    setTimeout(() => {
      setIsCalling(false);
    }, 6000);
  };

  return (
    <div className="p-6 rounded-xl bg-surface shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="phonelink_ring" size={20} className="text-primary" />
          <span className="text-[16px] font-bold text-on-surface">
            Test Call Simulator
          </span>
        </div>
        <span className="text-[12px] text-success uppercase border border-success/30 bg-surface-elevated px-2 py-0.5 rounded font-semibold">
          Operator Sandbox
        </span>
      </div>

      <p className="text-[14px] text-on-surface-variant leading-relaxed">
        Place an instant test call to an operator phone to audit voice clarity and AI conversation responses in real time.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-semibold text-on-surface-variant uppercase">
          AI Persona
        </label>
        <select
          value={targetAgent}
          onChange={(e) => setTargetAgent(e.target.value)}
          className="w-full bg-surface-elevated text-on-surface text-[14px] p-2.5 rounded-lg outline-none focus:border-primary border border-border cursor-pointer"
        >
          <option>Rachel • Enterprise Logistics Outreach</option>
          <option>Marcus • Industrial Surplus Buyer</option>
          <option>Elena • Client Account Manager</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-semibold text-on-surface-variant uppercase">
          Destination Phone Number
        </label>
        <div className="relative">
          <input
            value={destinationNumber}
            onChange={(e) => setDestinationNumber(e.target.value)}
            className="w-full bg-surface-elevated text-on-surface text-[14px] p-2.5 rounded-lg pl-9 outline-none focus:border-primary border border-border"
            placeholder="+1 (555) 019-2834"
            type="tel"
          />
          <Icon name="call" size={18} className="absolute left-2.5 top-3 text-on-surface-muted pointer-events-none" />
        </div>
      </div>

      <button
        onClick={handleDispatchTest}
        disabled={isCalling}
        className={`w-full py-2.5 rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm ${
          isCalling
            ? 'bg-surface-secondary text-on-surface-muted cursor-not-allowed border border-border'
            : 'bg-primary text-on-primary hover:bg-primary-hover'
        }`}
        id="trigger-test-call-btn"
        type="button"
      >
        <Icon
          name={isCalling ? 'autorenew' : 'ring_volume'}
          size={18}
          className={isCalling ? 'animate-spin' : ''}
        />
        <span>{isCalling ? 'Connecting...' : 'Dispatch Test Call'}</span>
      </button>

      {isCalling && (
        <div
          className="flex items-center justify-between p-3 rounded-lg bg-accent-surface text-[13px] text-primary border border-secondary/30"
          id="test-call-status"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span>Calling terminal ({destinationNumber})...</span>
          </div>
          <span className="text-[11px] text-on-surface-variant font-mono">Twilio SID: CA9821</span>
        </div>
      )}
    </div>
  );
};
