'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface AgentStudioRibbonProps {
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onOpenSandbox?: () => void;
  onDeploy?: () => void;
}

export const AgentStudioRibbon: React.FC<AgentStudioRibbonProps> = ({
  selectedAgentId,
  onSelectAgent,
  onDeploy,
}) => {
  const [deployState, setDeployState] = useState<'idle' | 'deploying' | 'deployed'>('idle');

  const handleDeploy = () => {
    setDeployState('deploying');
    onDeploy?.();
    setTimeout(() => {
      setDeployState('deployed');
      setTimeout(() => setDeployState('idle'), 2000);
    }, 800);
  };

  return (
    <div className="w-full bg-surface px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-border">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-bold text-on-surface tracking-tight">
              AI Calling Personas
            </h1>
            <span className="px-2.5 py-0.5 rounded bg-success-surface text-success text-[12px] font-semibold border border-success/20">
              Active in Production
            </span>
          </div>
          <span className="text-[13px] text-on-surface-variant">
            Configure calling scripts, objection handling, and operational qualification rules.
          </span>
        </div>

        <div className="h-6 w-px bg-border hidden md:block" />

        {/* Persona Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-secondary overflow-x-auto max-w-full border border-border">
          <button
            onClick={() => onSelectAgent('ag_rachel')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors ${
              selectedAgentId === 'ag_rachel'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface'
            }`}
            type="button"
          >
            <span>Rachel (Sales Specialist)</span>
          </button>

          <button
            onClick={() => onSelectAgent('ag_marcus')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
              selectedAgentId === 'ag_marcus'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface'
            }`}
            type="button"
          >
            <span>Marcus (Discovery &amp; Volume)</span>
          </button>

          <button
            onClick={() => onSelectAgent('ag_elena')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
              selectedAgentId === 'ag_elena'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface'
            }`}
            type="button"
          >
            <span>Elena (Follow-up)</span>
          </button>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDeploy}
          disabled={deployState === 'deploying'}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors shadow-sm ${
            deployState === 'deployed'
              ? 'bg-success text-white'
              : 'bg-primary text-on-primary hover:bg-primary-hover'
          }`}
          type="button"
        >
          <Icon name={deployState === 'deployed' ? 'check' : 'publish'} size={16} />
          <span>{deployState === 'deployed' ? 'Saved & Deployed' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
};
