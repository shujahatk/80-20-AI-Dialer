'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface DtmfKeypadProps {
  initialDigits?: string;
  onSendDtmf?: (tone: string) => void;
}

export const DtmfKeypad: React.FC<DtmfKeypadProps> = ({
  initialDigits = '',
  onSendDtmf,
}) => {
  const [digits, setDigits] = useState(initialDigits);

  const keys = [
    { key: '1', sub: '' },
    { key: '2', sub: 'ABC' },
    { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' },
    { key: '5', sub: 'JKL' },
    { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' },
    { key: '8', sub: 'TUV' },
    { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' },
    { key: '0', sub: '+' },
    { key: '#', sub: '' },
  ];

  const handleKeyPress = (val: string) => {
    setDigits((prev) => prev + val);
    onSendDtmf?.(val);
  };

  const handleBackspace = () => {
    setDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div
      className="bg-surface-elevated rounded-xl p-4 flex flex-col gap-3 border border-border"
      id="keypad-panel"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-on-surface-variant text-[13px] font-medium">
          <Icon name="dialpad" size={16} />
          <span>Telephone Keypad</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[16px] text-on-surface font-bold tracking-widest min-w-[3rem] text-right"
            id="keypad-digits"
          >
            {digits || '—'}
          </span>
          {digits && (
            <button
              onClick={handleBackspace}
              className="text-on-surface-variant hover:text-error transition-colors p-1"
              type="button"
              title="Backspace"
            >
              <Icon name="backspace" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map(({ key, sub }) => (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            className="py-2 px-3 rounded-md bg-surface hover:bg-surface-secondary text-on-surface text-[16px] font-semibold flex flex-col items-center justify-center transition-colors border border-border shadow-sm min-h-[44px]"
            type="button"
          >
            <span>{key}</span>
            {sub && (
              <span className="text-[10px] text-on-surface-muted font-normal leading-none mt-0.5">
                {sub}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
