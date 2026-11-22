'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@/lib/ui/icons';
import type { TranscriptEntry } from '@/types';
import type { TranscriptSegment } from '@/services/voice/types';

interface LiveTranscriptFeedProps {
  entries?: (TranscriptEntry | TranscriptSegment)[];
}

export const LiveTranscriptFeed: React.FC<LiveTranscriptFeedProps> = ({ entries = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const normalizedEntries = entries.map((e, idx) => {
    const isSegment = 'sequenceNumber' in e;
    const speaker = isSegment ? (e.speaker === 'agent' ? 'ai' : 'prospect') : e.speaker;
    const speakerName = isSegment
      ? e.speakerName || (e.speaker === 'agent' ? 'RM AI Assistant' : 'Prospect')
      : e.speakerName || (speaker === 'ai' ? 'RM AI Assistant' : 'Prospect');
    const timestamp = isSegment
      ? new Date(e.startedAtMs || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : (e as TranscriptEntry).timestamp || '00:00';

    return {
      id: e.id || `tr_${idx}`,
      speaker,
      speakerName,
      text: e.text,
      timestamp,
      isStreaming: !isSegment ? (e as TranscriptEntry).isStreaming : !e.isFinal,
    };
  });

  const filteredEntries = normalizedEntries.filter((e) =>
    e.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.speakerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopy = () => {
    const fullText = normalizedEntries
      .map((e) => `[${e.timestamp}] ${e.speakerName}: ${e.text}`)
      .join('\n');
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rm-card flex min-h-[360px] flex-1 flex-col gap-3 p-5">
      {/* Header with Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="description" size={20} className="text-primary" />
          <h3 className="text-[16px] font-bold text-on-surface">
            Call Transcript
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <button
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`p-1.5 rounded transition-colors text-[13px] flex items-center gap-1 ${
              autoScroll
                ? 'bg-accent-surface text-primary font-semibold border border-accent/20'
                : 'hover:bg-surface-secondary text-on-surface-variant'
            }`}
            title={autoScroll ? 'Autoscroll enabled' : 'Autoscroll paused'}
            type="button"
          >
            <Icon name="arrow_downward" size={16} />
            <span className="hidden sm:inline">Auto-scroll</span>
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-surface-secondary text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 text-[13px]"
            title="Copy Transcript"
            type="button"
          >
            <Icon name={copied ? 'check' : 'content_copy'} size={16} />
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Filter / Quick Search Input */}
      <div className="relative w-full">
        <Icon
          name="search"
          size={18}
          className="text-on-surface-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter conversation text..."
          className="w-full bg-surface-elevated text-on-surface placeholder:text-on-surface-muted rounded-md pl-9 pr-3 py-1.5 text-[14px] border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Transcript Log Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto max-h-[420px] flex flex-col gap-2.5 pr-1"
      >
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-on-surface-muted">
            <Icon name="forum" size={32} className="mb-1" />
            <p className="text-[14px]">Transcript will appear here once audio commences.</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isAi = entry.speaker === 'ai';
            return (
              <div
                key={entry.id}
                className={`p-3.5 rounded-lg border text-[15px] leading-relaxed transition-colors ${
                  isAi
                    ? 'bg-accent-surface border-accent/20 text-on-surface'
                    : 'bg-surface-secondary border-border text-on-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-[13px]">
                  <span className={`font-semibold ${isAi ? 'text-primary' : 'text-secondary'}`}>
                    {entry.speakerName}
                  </span>
                  <span className="text-on-surface-muted text-[12px]">{entry.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{entry.text}</p>
                {entry.isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
