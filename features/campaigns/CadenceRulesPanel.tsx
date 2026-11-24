'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export const CadenceRulesPanel: React.FC = () => {
  const [isPlayingVm, setIsPlayingVm] = useState(false);
  const [vmNotice, setVmNotice] = useState<string | null>(null);

  const toggleVmPlay = () => {
    if (!isPlayingVm) {
      setIsPlayingVm(true);
      setVmNotice('Playing Voicemail Audio Preview: "Hello, this is Rachel from RM Group calling regarding raw materials..."');
      setTimeout(() => {
        setIsPlayingVm(false);
        setVmNotice(null);
      }, 5000);
    } else {
      setIsPlayingVm(false);
      setVmNotice(null);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-surface shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="alt_route" size={20} className="text-primary" />
          <span className="text-[15px] font-bold text-on-surface">
            Calling Schedule Rules
          </span>
        </div>
        <span className="text-[12px] font-semibold text-primary px-2 py-0.5 rounded bg-success-surface border border-success/20">
          Standard Policy
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Rule 1 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border">
          <div className="flex items-center gap-3">
            <Icon name="record_voice_over" size={20} className="text-primary" />
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-on-surface">
                Human Voice Detection
              </span>
              <span className="text-[12px] text-on-surface-variant">
                Distinguish human answers from answering machines
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-success-surface text-success text-[11px] font-bold">
            ACTIVE
          </span>
        </div>

        {/* Rule 2 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border">
          <div className="flex items-center gap-3">
            <Icon name="voicemail" size={20} className="text-secondary" />
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-on-surface">
                Voicemail Message Drop
              </span>
              <span className="text-[12px] text-on-surface-variant">
                RM Group standard inquiry template
              </span>
            </div>
          </div>
          <button
            onClick={toggleVmPlay}
            className={`p-1.5 rounded transition-colors ${
              isPlayingVm
                ? 'bg-primary text-on-primary'
                : 'bg-surface-secondary text-on-surface hover:bg-border'
            }`}
            title="Preview Voicemail Audio"
            type="button"
          >
            <Icon name={isPlayingVm ? 'stop' : 'play_arrow'} size={18} />
          </button>
        </div>

        {vmNotice && (
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center gap-2 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping shrink-0" />
            <span>{vmNotice}</span>
          </div>
        )}

        {/* Rule 3 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border">
          <div className="flex items-center gap-3">
            <Icon name="schedule" size={20} className="text-primary" />
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-on-surface">
                Calling Hours Compliance
              </span>
              <span className="text-[12px] text-on-surface-variant">
                Calls restricted to 09:00 - 17:30 CET
              </span>
            </div>
          </div>
          <span className="text-[12px] font-semibold text-success">
            Enforced
          </span>
        </div>
      </div>
    </div>
  );
};
