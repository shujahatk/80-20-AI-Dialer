'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface SystemPromptEditorProps {
  initialPrompt?: string;
  onPromptChange?: (prompt: string) => void;
}

export const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  initialPrompt,
  onPromptChange,
}) => {
  const defaultPrompt =
    initialPrompt ??
    `ROLE & GUARDRAILS: STRICT_JSON_FLOW = ON\nYou are Rachel, an elite Business Development Executive at RM Logistics. Speak with crisp authority, rapid cadence, and strategic curiosity.\n\n<Rule_1> Never deliver monologues longer than 2.5 sentences. Always end with a consultative checkpoint question.\n<Rule_2> If {{fleet_size}} > 50 units, pivot straight into dedicated carrier freight margin automation.\n<Rule_3> Disarm resistance using tactical acknowledgement. Never argue.`;

  const [prompt, setPrompt] = useState(defaultPrompt);
  const [copied, setCopied] = useState(false);

  const variables = [
    { name: '{{first_name}}', color: 'text-primary' },
    { name: '{{company}}', color: 'text-primary' },
    { name: '{{fleet_size}}', color: 'text-primary' },
    { name: '{{competitor}}', color: 'text-primary' },
    { name: '{{calendar_link}}', color: 'text-secondary' },
  ];

  const injectVariable = (varName: string) => {
    const updated = prompt + ' ' + varName;
    setPrompt(updated);
    onPromptChange?.(updated);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-surface-container-low p-space-base flex flex-col gap-space-sm shadow-sm flex-1 border border-outline-variant/10">
      <div className="flex items-center justify-between flex-wrap gap-space-xs">
        <div className="flex items-center gap-space-xs">
          <Icon name="terminal" size={18} className="text-primary" />
          <h2 className="font-headline-md text-body-md text-on-surface uppercase tracking-wider font-semibold">
            Core Agent System Prompt
          </h2>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="font-label-caps text-label-caps px-space-xs py-space-2xs rounded bg-surface-container text-on-surface-variant border border-outline-variant/10">
            Tokens: 1,428 / 4,096
          </span>
          <button
            onClick={handleCopy}
            className="p-space-2xs text-on-surface-variant hover:text-on-surface transition-colors"
            type="button"
            title="Copy prompt"
          >
            <Icon name={copied ? 'check' : 'content_copy'} size={18} />
          </button>
        </div>
      </div>

      {/* Dynamic Variable Chips Pill Bar */}
      <div className="flex flex-wrap items-center gap-space-2xs py-space-2xs border-y border-outline-variant/10">
        <span className="font-label-caps text-label-caps text-on-surface-variant pr-space-xs uppercase">
          Inject:
        </span>
        {variables.map((v) => (
          <button
            key={v.name}
            onClick={() => injectVariable(v.name)}
            className={`px-space-xs py-space-2xs rounded bg-surface-container hover:bg-surface-container-high font-label-caps text-label-caps transition-colors border border-outline-variant/10 ${v.color}`}
            type="button"
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* Code/Prompt Editor */}
      <div className="relative rounded-lg bg-surface-container-lowest p-space-sm font-data-tabular text-body-sm text-on-surface leading-relaxed overflow-hidden border border-outline-variant/10">
        <div className="text-on-surface-variant font-label-caps text-label-caps pb-space-xs border-b border-surface-container-highest/20 mb-space-xs flex justify-between">
          <span>ROLE &amp; GUARDRAILS</span>
          <span className="text-primary font-bold">STRICT_JSON_FLOW = ON</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            onPromptChange?.(e.target.value);
          }}
          className="w-full bg-transparent text-on-surface font-data-tabular text-body-sm resize-none outline-none min-h-[140px] leading-relaxed"
          rows={6}
        />
      </div>
    </div>
  );
};
