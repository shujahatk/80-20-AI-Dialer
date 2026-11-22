'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export function StorageSecurityPanel() {
  const [retention, setRetention] = useState<number>(90);
  const [piiRedaction, setPiiRedaction] = useState(true);
  const [dncAutoScrub, setDncAutoScrub] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Data Retention & Storage Policy */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="lock" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Data Retention &amp; Storage Encryption</h2>
              <p className="text-xs text-on-surface-variant">
                GDPR &amp; SOC2 Type II compliant storage for audio recordings and AI transcripts.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-success/15 text-success text-xs font-semibold border border-success/30 font-mono">
            AES-256 ENCRYPTED
          </span>
        </div>

        {/* Retention Period Selector */}
        <div className="flex flex-col gap-2.5 p-4 bg-surface-elevated rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface">Audio &amp; Transcript Retention Period</span>
            <span className="text-xs font-mono font-bold text-primary">{retention} Days Auto-Purge</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Call recordings older than this limit are permanently scrubbed from cold storage.
          </p>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {[30, 90, 180, 365].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRetention(days)}
                className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                  retention === days
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-surface text-on-surface border-border hover:bg-surface-elevated'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* PII & Audio Redaction Filter */}
        <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-on-surface">Automatic PII &amp; Payment Redaction</span>
            <p className="text-xs text-on-surface-variant">
              Mutes credit card numbers, SSNs, and sensitive numbers in audio recordings and transcripts.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={piiRedaction}
              onChange={(e) => setPiiRedaction(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>

        {/* DNC Auto Scrub */}
        <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-on-surface">Do-Not-Call (DNC) Registry Auto-Scrub</span>
            <p className="text-xs text-on-surface-variant">
              Automatically checks federal and organization DNC tables before every dispatch.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={dncAutoScrub}
              onChange={(e) => setDncAutoScrub(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
      </div>

      {/* API Key Management */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="key" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Organization Secret API Access Keys</h2>
              <p className="text-xs text-on-surface-variant">
                Used to authorize programmatic API calls, webhooks, and Retell custom LLM connections.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface">Organization secrets</label>
          <div className="flex items-center rounded-lg bg-surface-elevated border border-border px-3.5 py-2.5 text-sm gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              readOnly
              value="••••••••••••••••••••"
              className="bg-transparent border-none text-on-surface-variant font-mono text-xs focus:outline-none flex-1"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((p) => !p)}
              className="text-xs text-on-surface-variant hover:text-on-surface font-semibold"
            >
              Masked
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            API keys and provider secrets are stored in server environment variables and are not displayed in the console.
          </p>
        </div>
      </div>
    </div>
  );
}
