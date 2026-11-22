'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/lib/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';

interface DualTrackAudioPlayerProps {
  src?: string | null;
  durationSeconds?: number;
  onTimeChange?: (seconds: number) => void;
}

export const DualTrackAudioPlayer: React.FC<DualTrackAudioPlayerProps> = ({
  src,
  durationSeconds = 0,
  onTimeChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSec(0);
    setIsPlaying(false);
    setDuration(durationSeconds);
    setError(null);
    setIsLoading(Boolean(src));
  }, [src, durationSeconds]);

  const formatTime = (sec: number) => {
    const safe = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!src) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <EmptyState
          icon="graphic_eq"
          title="Recording unavailable"
          description="A player appears here when a stored recording URL is present for this call."
        />
      </div>
    );
  }

  const total = duration || durationSeconds || 1;
  const playheadPercent = Math.min(100, (currentSec / total) * 100);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Icon name="graphic_eq" size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-on-surface">Call recording</span>
            <span className="text-[12px] text-on-surface-variant">
              {isLoading ? 'Loading audio…' : error || 'Stored recording'}
            </span>
          </div>
        </div>
        <span className="font-mono text-[12px] text-on-surface-muted">
          {formatTime(currentSec)} / {formatTime(total)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          if (!Number.isNaN(event.currentTarget.duration) && event.currentTarget.duration !== Infinity) {
            setDuration(event.currentTarget.duration);
          }
          setIsLoading(false);
        }}
        onTimeUpdate={(event) => {
          const seconds = event.currentTarget.currentTime;
          setCurrentSec(seconds);
          onTimeChange?.(seconds);
        }}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsLoading(false);
          setError('Recording could not be loaded');
          setIsPlaying(false);
        }}
      />

      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(total))}
        value={Math.floor(currentSec)}
        aria-label="Seek recording"
        className="w-full accent-primary"
        onChange={(event) => {
          const next = Number(event.target.value);
          const audio = audioRef.current;
          if (audio) audio.currentTime = next;
          setCurrentSec(next);
          onTimeChange?.(next);
        }}
      />
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
        <div className="h-full rounded-full bg-primary transition-[width] duration-fast" style={{ width: `${playheadPercent}%` }} />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-45"
          disabled={Boolean(error)}
          onClick={async () => {
            const audio = audioRef.current;
            if (!audio) return;
            if (isPlaying) {
              audio.pause();
              setIsPlaying(false);
              return;
            }
            try {
              await audio.play();
              setIsPlaying(true);
            } catch {
              setError('Playback was blocked');
            }
          }}
        >
          <Icon name={isPlaying ? 'pause' : 'play_arrow'} size={16} />
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  );
};
