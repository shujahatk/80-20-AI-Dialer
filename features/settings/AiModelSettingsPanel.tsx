'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export function AiModelSettingsPanel() {
  const [llmProvider, setLlmProvider] = useState('claude-3-5-sonnet-20241022');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(250);
  const [customLlmWsUrl, setCustomLlmWsUrl] = useState('wss://api.rmdialer.com/v1/retell/custom-llm');
  const [ragStrictness, setRagStrictness] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(
    `You are an elite, consultative B2B Operations specialist representing RM Global Materials.\nAlways maintain high conversational warmth, concise single-sentence turns, and immediately respect Do-Not-Call requests.`
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Primary Reasoning Model */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="psychology" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Primary Reasoning &amp; Custom LLM</h2>
              <p className="text-xs text-on-surface-variant">
                Configure Anthropic Claude intelligence, token generation limits, and WebSocket bridging.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
            Claude 3.5 Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Core Reasoning Model</label>
            <select
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="claude-3-5-sonnet-20241022">Anthropic Claude 3.5 Sonnet (Recommended for Enterprise Sales)</option>
              <option value="claude-3-5-haiku-20241022">Anthropic Claude 3.5 Haiku (Fast Triage &amp; High Volume)</option>
              <option value="gpt-4o">OpenAI GPT-4o (Fallback Multi-modal)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Retell Custom LLM Bridge URL</label>
            <input
              type="text"
              value={customLlmWsUrl}
              onChange={(e) => setCustomLlmWsUrl(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border font-mono text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Hyperparameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Model Temperature (Creativity vs Determinism)</span>
              <span className="text-xs font-mono font-bold text-primary">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.8"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
              <span>0.0 Strict Deterministic</span>
              <span>0.2 Ideal Spoken</span>
              <span>0.8 Creative</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Max Turn Tokens</span>
              <span className="text-xs font-mono font-bold text-primary">{maxTokens} tokens</span>
            </div>
            <input
              type="range"
              min="100"
              max="500"
              step="25"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-[11px] text-on-surface-variant">
              Prevents the AI from giving long-winded monologues over the phone.
            </p>
          </div>
        </div>
      </div>

      {/* Global Master Persona & System Instructions */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="description" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Global System Prompt &amp; Compliance Prefix</h2>
              <p className="text-xs text-on-surface-variant">
                Master prompt injected at the root of every outbound agent execution turn.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full p-3.5 rounded-lg bg-surface-elevated border border-border font-mono text-xs text-on-surface focus:outline-none focus:border-primary leading-relaxed"
          />
        </div>

        <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-on-surface">Strict Knowledge Base RAG Grounding</span>
            <p className="text-xs text-on-surface-variant">
              Forces agent to cite verified knowledge docs and prevents unauthorized pricing guarantees.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={ragStrictness}
              onChange={(e) => setRagStrictness(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
      </div>
    </div>
  );
}
