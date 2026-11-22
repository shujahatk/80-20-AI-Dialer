'use client';

import React from 'react';
import { Icon } from '@/lib/ui/icons';

export const SETTINGS_CATEGORIES = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'integrations', label: 'Providers & Gateways', icon: 'hub' },
  { id: 'calling', label: 'Calling', icon: 'call' },
  { id: 'ai-voice', label: 'Retell / Voice', icon: 'record_voice_over' },
  { id: 'ai-model', label: 'AI', icon: 'psychology' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'working-hours', label: 'Working Hours', icon: 'schedule' },
  { id: 'users', label: 'Users & Roles', icon: 'group' },
  { id: 'security', label: 'Security / System', icon: 'lock' },
  { id: 'email-automation', label: 'Email Automation', icon: 'mail' },
];

interface SettingsCategoryTabsProps {
  activeCategory?: string;
  onSelectCategory?: (id: string) => void;
}

export function SettingsCategoryTabs({
  activeCategory = 'general',
  onSelectCategory,
}: SettingsCategoryTabsProps) {
  return (
    <nav aria-label="Settings sections" className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 lg:sticky lg:top-16 lg:flex-col lg:overflow-visible">
      {SETTINGS_CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory?.(cat.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
              isActive
                ? 'bg-primary font-medium text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-elevated hover:text-on-surface'
            }`}
          >
            <Icon name={cat.icon} size={16} />
            <span>{cat.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
