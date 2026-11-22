import React, { useState, useRef } from 'react';
import type { AiAgent } from '@/types';
import { Icon } from '@/lib/ui/icons';

export const RETELL_VOICE_PRESETS = [
  { voiceId: '11labs-Adrian', name: 'Adrian', gender: 'Male', description: 'Deep, confident commercial voice' },
  { voiceId: '11labs-Chloe', name: 'Chloe', gender: 'Female', description: 'Warm, approachable customer success voice' },
  { voiceId: '11labs-Brian', name: 'Brian', gender: 'Male', description: 'Energetic, direct sales voice' },
  { voiceId: 'openai-Alloy', name: 'Alloy', gender: 'Neutral', description: 'Neutral, balanced conversational tone' },
];

interface VoiceTuningCardProps {
  agent: AiAgent;
}

export const VoiceTuningCard: React.FC<VoiceTuningCardProps> = ({ agent }) => {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState(
    RETELL_VOICE_PRESETS[0]?.voiceId ?? '11labs-Adrian'
  );
  const [speed, setSpeed] = useState(1.0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleTogglePreview = async () => {
    if (isPlayingVoice) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlayingVoice(false);
      return;
    }

    try {
      setIsPlayingVoice(true);
      setStatusMessage('Playing sample...');

      const response = await fetch('/api/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: selectedVoiceId,
          speed,
        }),
      });

      if (!response.ok) {
        throw new Error(`Preview failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const player = audioRef.current;
      player.src = audioUrl;

      player.onended = () => {
        setIsPlayingVoice(false);
        setStatusMessage(null);
        URL.revokeObjectURL(audioUrl);
      };

      player.onerror = () => {
        setIsPlayingVoice(false);
        setStatusMessage('Playback failed');
      };

      await player.play();
    } catch (err: unknown) {
      console.warn('[VoiceTuningCard] Preview error', err);
      setIsPlayingVoice(false);
      setStatusMessage('Voice preview unavailable');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="rounded-xl bg-surface p-6 flex flex-col gap-4 shadow-sm border border-border">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="record_voice_over" size={20} className="text-primary" />
          <h2 className="text-[16px] font-bold text-on-surface">
            AI Voice Selection &amp; Audio Preview
          </h2>
        </div>
        <span className="text-[13px] text-secondary font-medium">
          Retell Neural Voice Engine
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
        {/* Voice Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-on-surface">Selected Voice Model</label>
          <select
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="bg-surface-secondary text-on-surface rounded-md px-3 py-2 border border-border text-[14px] focus:outline-none focus:border-primary"
          >
            {RETELL_VOICE_PRESETS.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>
                {v.name} — {v.gender} ({v.description})
              </option>
            ))}
          </select>
        </div>

        {/* Speed Adjustment */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-on-surface">Speaking Speed ({speed}x)</label>
          <input
            type="range"
            min="0.75"
            max="1.25"
            step="0.05"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="mt-2 accent-primary"
          />
        </div>
      </div>

      {/* Audio Sample Preview */}
      <div className="pt-2 flex items-center justify-between">
        <button
          onClick={handleTogglePreview}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-surface-secondary hover:bg-surface-elevated text-on-surface font-semibold text-[13px] border border-border transition-colors"
          type="button"
        >
          <Icon name={isPlayingVoice ? 'stop' : 'play_arrow'} size={18} className="text-primary" />
          <span>{isPlayingVoice ? 'Stop Audio Sample' : 'Play Voice Preview Sample'}</span>
        </button>

        {statusMessage && (
          <span className="text-[13px] text-secondary font-medium">{statusMessage}</span>
        )}
      </div>
    </div>
  );
};
