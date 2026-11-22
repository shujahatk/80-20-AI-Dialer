'use client';

import React, { useState } from 'react';
import type { AiAgent } from '@/types';
import { Icon } from '@/lib/ui/icons';

interface PersonaIdentityCardProps {
  agent: AiAgent;
}

export const PersonaIdentityCard: React.FC<PersonaIdentityCardProps> = ({ agent }) => {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);

  return (
    <div className="rounded-xl bg-surface-container-low p-space-base flex flex-col gap-space-md shadow-sm border border-outline-variant/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <Icon name="tune" size={18} className="text-primary" />
          <h2 className="font-headline-md text-body-md text-on-surface uppercase tracking-wider font-semibold">
            Persona &amp; Identity
          </h2>
        </div>
        <span className="flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-tertiary/15 text-tertiary font-label-caps text-label-caps border border-tertiary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
          LIVE IN PRODUCTION
        </span>
      </div>

      <div className="flex flex-col gap-space-xs">
        <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
          Agent Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface-container px-space-md py-space-xs rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-high transition-colors border border-outline-variant/10"
          type="text"
        />
      </div>

      <div className="flex flex-col gap-space-xs">
        <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
          Operational Role &amp; Mandate
        </label>
        <textarea
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-surface-container p-space-sm rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-high resize-none transition-colors border border-outline-variant/10"
          rows={2}
        />
      </div>
    </div>
  );
};
