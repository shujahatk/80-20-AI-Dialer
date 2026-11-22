'use client';

import React from 'react';
import { Sun, Moon, Laptop, Palette } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme/theme-context';

export function AppearanceSettingsCard() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const options: Array<{
    id: Theme;
    label: string;
    description: string;
    icon: typeof Sun;
    previewBg: string;
    previewSurface: string;
    previewSidebar: string;
  }> = [
    {
      id: 'light',
      label: 'Light',
      description: 'Clean off-white background with Deep RM Green accents.',
      icon: Sun,
      previewBg: 'bg-[#F5F4EF]',
      previewSurface: 'bg-[#FFFFFF] border-[#D7D8D2]',
      previewSidebar: 'bg-[#243D32]',
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Deep charcoal with muted forest green for low-light use.',
      icon: Moon,
      previewBg: 'bg-[#171A18]',
      previewSurface: 'bg-[#1E221F] border-[#353B36]',
      previewSidebar: 'bg-[#1D3027]',
    },
    {
      id: 'system',
      label: 'Use System Setting',
      description: 'Automatically match your operating system theme preference.',
      icon: Laptop,
      previewBg: 'bg-gradient-to-r from-[#F5F4EF] to-[#171A18]',
      previewSurface: 'bg-surface border-border',
      previewSidebar: 'bg-sidebar',
    },
  ];

  return (
    <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="text-[17px] font-bold text-on-surface">Appearance</h2>
        </div>
        <p className="text-[14px] text-on-surface-variant">
          Choose how RM AI Dialer looks on this device. Your preference will be saved locally.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {options.map((opt) => {
          const isSelected = theme === opt.id;
          const IconComponent = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-primary bg-surface-elevated shadow-sm'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-elevated'
              }`}
            >
              {/* Visual Preview Box */}
              <div className={`w-full h-24 rounded-lg mb-3.5 p-2 flex gap-1.5 border border-border/50 overflow-hidden ${opt.previewBg}`}>
                <div className={`w-1/4 h-full rounded-md ${opt.previewSidebar}`} />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className={`h-4 rounded-md border ${opt.previewSurface}`} />
                  <div className={`flex-1 rounded-md border ${opt.previewSurface}`} />
                </div>
              </div>

              {/* Title & Radio Indicator */}
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <IconComponent className={`w-4 h-4 ${isSelected ? 'text-primary font-bold' : 'text-on-surface-variant'}`} />
                  <span className={`text-[15px] font-semibold ${isSelected ? 'text-on-surface font-bold' : 'text-on-surface'}`}>
                    {opt.label}
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  isSelected ? 'border-primary bg-primary' : 'border-border-strong bg-surface'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-on-primary" />}
                </div>
              </div>

              <p className="text-[13px] text-on-surface-variant leading-relaxed">
                {opt.description}
              </p>

              {opt.id === 'system' && (
                <div className="mt-2 text-[11px] font-medium text-accent">
                  Currently active: <span className="font-bold capitalize">{resolvedTheme}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
