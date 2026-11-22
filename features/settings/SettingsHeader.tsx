'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';

interface SettingsHeaderProps {
  onDeploy?: () => void;
  isDeploying?: boolean;
}

export function SettingsHeader({ onDeploy, isDeploying }: SettingsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-xl border border-border shadow-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold text-on-surface tracking-tight">
          System Settings
        </h1>
        <p className="text-[14px] text-on-surface-variant max-w-2xl">
          Manage telephony services, voice synthesis, outbound compliance windows, and data security.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onDeploy}
          disabled={isDeploying}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-[14px] font-semibold hover:bg-primary-hover transition-colors shadow-sm ${
            isDeploying ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          <Icon name="save" size={18} />
          <span>{isDeploying ? 'Saving Changes...' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
}
