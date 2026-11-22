'use client';

import React, { useState } from 'react';
import type { TranscriptEntry } from '@/types';
import { Icon } from '@/lib/ui/icons';

interface SynchronizedTranscriptProps {
  turns: TranscriptEntry[];
  currentPlaybackSeconds?: number;
}

export const SynchronizedTranscript: React.FC<SynchronizedTranscriptProps> = ({
  turns,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const fullText = turns
      .map((t) => `[${t.timestamp}] ${t.speakerName}: "${t.text}"`)
      .join('\n\n');
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col p-5 rounded-xl bg-surface gap-3 border border-border shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="subtitles" size={20} className="text-primary" />
          <span className="text-[15px] font-bold text-on-surface">
            Synchronized Transcript
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-elevated text-[12px] text-on-surface-variant border border-border">
            {turns.length} Turns
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-elevated hover:bg-surface-secondary text-on-surface text-[13px] font-medium border border-border transition-colors"
          type="button"
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={16} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Message Stream List */}
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
        {turns.map((turn) => {
          const isAi = turn.speaker === 'ai';

          return (
            <div
              key={turn.id}
              className={`p-3.5 rounded-lg border text-[14px] leading-relaxed transition-colors ${
                isAi
                  ? 'bg-accent-surface border-accent/20 text-on-surface'
                  : 'bg-surface-secondary border-border text-on-surface'
              }`}
            >
              <div className="flex items-center justify-between mb-1 text-[13px]">
                <span className={`font-semibold ${isAi ? 'text-primary' : 'text-secondary'}`}>
                  {turn.speakerName}
                </span>
                <span className="text-on-surface-muted text-[12px]">{turn.timestamp}</span>
              </div>
              <p className="whitespace-pre-wrap">{turn.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
