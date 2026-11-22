'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export function AiVoiceSettingsPanel() {
  const [ttsEngine, setTtsEngine] = useState('elevenlabs_turbo_v2');
  const [baseVoice, setBaseVoice] = useState('rachel');
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.75);
  const [similarity, setSimilarity] = useState(0.85);
  const [bargeInMs, setBargeInMs] = useState(250);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const handlePlayPreview = () => {
    setIsPlayingPreview(true);
    setTimeout(() => {
      setIsPlayingPreview(false);
    }, 2500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Voice Synthesis Engine */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="record_voice_over" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Voice Synthesis &amp; Acoustic Engine</h2>
              <p className="text-xs text-on-surface-variant">
                Configure real-time text-to-speech models, vocal stability, and conversational cadence.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePlayPreview}
            disabled={isPlayingPreview}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Icon name={isPlayingPreview ? 'volume_up' : 'play_arrow'} size={16} />
            <span>{isPlayingPreview ? 'Playing Preview...' : 'Test Voice Sample'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">TTS Generation Engine</label>
            <select
              value={ttsEngine}
              onChange={(e) => setTtsEngine(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="elevenlabs_turbo_v2">ElevenLabs v2 Turbo (98ms streaming latency)</option>
              <option value="cartesia_sonic">Cartesia Sonic (85ms ultra-low latency)</option>
              <option value="deepgram_aura">Deepgram Aura (High fidelity conversational)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Default Base Voice Persona</label>
            <select
              value={baseVoice}
              onChange={(e) => setBaseVoice(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="rachel">Rachel — Professional, consultative, warm executive</option>
              <option value="marcus">Marcus — Authoritative B2B enterprise SDR</option>
              <option value="elena">Elena — Fast-paced, engaging triage specialist</option>
            </select>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Speed */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Speaking Speed</span>
              <span className="text-xs font-mono font-bold text-primary">{speed}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
              <span>0.8x Natural</span>
              <span>1.0x Normal</span>
              <span>1.3x Rapid</span>
            </div>
          </div>

          {/* Stability */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Vocal Stability</span>
              <span className="text-xs font-mono font-bold text-primary">{Math.round(stability * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={stability}
              onChange={(e) => setStability(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
              <span>Dynamic</span>
              <span>Balanced (75%)</span>
              <span>Monotone</span>
            </div>
          </div>

          {/* Similarity */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Clarity &amp; Similarity</span>
              <span className="text-xs font-mono font-bold text-primary">{Math.round(similarity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={similarity}
              onChange={(e) => setSimilarity(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
              <span>50%</span>
              <span>85% Crisp</span>
              <span>100% Strict</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interruption & Barge-in Coordinator */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="hearing" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Conversational Turn-Taking &amp; Interruption</h2>
              <p className="text-xs text-on-surface-variant">
                Control how swiftly the AI halts speaking when the prospect speaks.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Interruption Cutoff Window</span>
              <span className="text-xs font-mono font-bold text-primary">{bargeInMs}ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="600"
              step="50"
              value={bargeInMs}
              onChange={(e) => setBargeInMs(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-xs text-on-surface-variant">
              Shorter windows allow natural human interjections without awkward overlapping talk.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-on-surface">Neural Noise Suppression &amp; AEC</span>
              <p className="text-xs text-on-surface-variant">
                Filters car engine background hum, speakerphone echo, and warehouse noise.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={noiseSuppression}
                onChange={(e) => setNoiseSuppression(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
