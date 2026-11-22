'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/ui/icons';

export const ManualDialpadStudio: React.FC = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callerId, setCallerId] = useState('+1 (415) 890-0000');

  const keypadKeys = [
    { num: '1', sub: '' },
    { num: '2', sub: 'ABC' },
    { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' },
    { num: '5', sub: 'JKL' },
    { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' },
    { num: '8', sub: 'TUV' },
    { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' },
    { num: '0', sub: '+' },
    { num: '#', sub: '' },
  ];

  const handleKeyPress = (char: string) => {
    setPhoneNumber((prev) => prev + char);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleStartCall = () => {
    if (!phoneNumber.trim()) return;
    router.push(`/workstation?dial=${encodeURIComponent(phoneNumber)}`);
  };

  return (
    <div className="flex flex-col w-full bg-background min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-[700px] w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <Link
              href="/workstation"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              <Icon name="arrow_back" size={16} />
              <span>Back to Active Workstation</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2.5">
              <Icon name="phone" size={26} className="text-primary" />
              <span>Manual Outbound Dialpad</span>
            </h1>
            <p className="text-sm text-on-surface-variant">
              Direct dial any telephone number via Twilio Carrier SIP trunk with custom caller ID.
            </p>
          </div>
        </div>

        {/* Dialpad Cockpit */}
        <div className="bg-surface rounded-2xl border border-border p-8 flex flex-col items-center gap-6 shadow-sm">
          {/* Caller ID selector */}
          <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface-elevated border border-border text-xs">
            <span className="text-on-surface-variant font-mono uppercase">Outbound Caller ID:</span>
            <select
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              className="bg-transparent text-on-surface font-mono font-semibold focus:outline-none"
            >
              <option value="+1 (415) 890-0000">+1 (415) 890-0000 (San Francisco Pool)</option>
              <option value="+1 (312) 402-0000">+1 (312) 402-0000 (Chicago Mid-West)</option>
              <option value="+1 (214) 555-0000">+1 (214) 555-0000 (Texas Hub)</option>
            </select>
          </div>

          {/* Phone Display */}
          <div className="w-full flex items-center justify-between px-6 py-4 rounded-xl bg-surface-secondary border border-border">
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone number..."
              className="bg-transparent text-2xl font-mono font-bold text-on-surface tracking-wider focus:outline-none w-full"
            />
            {phoneNumber && (
              <button
                type="button"
                onClick={handleBackspace}
                className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface transition-colors"
                aria-label="Backspace"
              >
                <Icon name="backspace" size={20} />
              </button>
            )}
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
            {keypadKeys.map((k) => (
              <button
                key={k.num}
                type="button"
                onClick={() => handleKeyPress(k.num)}
                className="h-16 rounded-xl bg-surface-elevated hover:bg-surface-secondary border border-border/80 flex flex-col items-center justify-center transition-transform active:scale-95 shadow-xs"
              >
                <span className="text-xl font-bold text-on-surface font-mono">{k.num}</span>
                {k.sub && (
                  <span className="text-[10px] font-mono text-on-surface-variant tracking-widest uppercase">
                    {k.sub}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Call Button */}
          <button
            type="button"
            onClick={handleStartCall}
            disabled={!phoneNumber.trim()}
            className="w-full max-w-sm py-4 rounded-xl bg-primary text-primary-foreground text-base font-bold hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center justify-center gap-2.5 shadow-lg"
          >
            <Icon name="phone" size={20} />
            <span>Initiate Direct Outbound Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
