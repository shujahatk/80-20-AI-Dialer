'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react';

type ProviderKey = 'retell' | 'twilio' | 'supabase' | 'anthropic';

interface StatusPayload {
  mode?: string;
  providers?: Record<string, string>;
  retellHealth?: { status?: string; configured?: boolean };
}

function displayStatus(raw?: string, live?: string) {
  if (live === 'healthy') return { label: 'Live', tone: 'success' as const };
  if (live === 'degraded') return { label: 'Degraded', tone: 'warning' as const };
  if (live === 'unreachable') return { label: 'Unreachable', tone: 'error' as const };
  const value = (raw || '').toLowerCase();
  if (value === 'configured') return { label: 'Credentials present', tone: 'info' as const };
  if (value === 'untested') return { label: 'Not verified', tone: 'neutral' as const };
  if (value === 'missing' || value === 'invalid') return { label: 'Missing', tone: 'warning' as const };
  return { label: 'Unknown', tone: 'neutral' as const };
}

function toneClass(tone: 'success' | 'warning' | 'error' | 'info' | 'neutral') {
  if (tone === 'success') return 'text-success';
  if (tone === 'warning') return 'text-warning';
  if (tone === 'error') return 'text-error';
  if (tone === 'info') return 'text-info';
  return 'text-on-surface-variant';
}

export function ProviderStatusMenu({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  const rows: Array<{ key: ProviderKey; name: string; live?: string }> = [
    { key: 'retell', name: 'Retell AI', live: payload?.retellHealth?.status },
    { key: 'twilio', name: 'Twilio' },
    { key: 'supabase', name: 'Supabase' },
    { key: 'anthropic', name: 'Anthropic Claude' },
  ];

  const summary = (() => {
    if (!loaded) return { label: 'Provider status', tone: 'neutral' as const, dot: 'bg-on-surface-muted' };
    const statuses = rows.map((row) => displayStatus(payload?.providers?.[row.key], row.live));
    if (statuses.some((item) => item.tone === 'error' || item.label === 'Missing')) {
      return { label: 'Review configuration', tone: 'warning' as const, dot: 'bg-warning' };
    }
    if (statuses.some((item) => item.label === 'Live' || item.label === 'Credentials present')) {
      return { label: 'Credentials configured', tone: 'info' as const, dot: 'bg-info' };
    }
    return { label: 'Not verified', tone: 'neutral' as const, dot: 'bg-on-surface-muted' };
  })();

  const load = async () => {
    setOpen((prev) => !prev);
    if (loaded) return;
    try {
      const res = await fetch('/api/providers/status');
      const json = await res.json();
      setPayload(json.success ? json.data : null);
    } catch {
      setPayload(null);
    } finally {
      setLoaded(true);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={load}
        className={`flex w-full items-center rounded text-[12px] text-sidebar-text/75 transition-colors duration-fast hover:bg-sidebar-hover hover:text-sidebar-text ${
          collapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
        }`}
        title="Provider configuration status"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${summary.dot}`} />
          {!collapsed && (
            <span className="truncate font-mono text-[11px] text-sidebar-text/70">{summary.label}</span>
          )}
        </div>
        {!collapsed && <Activity className="h-3.5 w-3.5 shrink-0 text-sidebar-text/40" />}
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-50 mb-2 rounded-lg border border-border bg-surface p-3 text-on-surface shadow-lg rm-panel ${
            collapsed ? 'left-16 w-64' : 'left-0 right-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-[12px] font-semibold">Provider status</span>
            <span className="font-mono text-[10px] text-on-surface-muted">{payload?.mode || 'unknown'} mode</span>
          </div>
          <div className="flex flex-col gap-1.5 py-2 text-[11px]">
            {rows.map((row) => {
              const status = displayStatus(payload?.providers?.[row.key], row.live);
              const Icon =
                status.tone === 'success'
                  ? CheckCircle2
                  : status.tone === 'warning' || status.tone === 'error'
                    ? AlertTriangle
                    : CircleDashed;
              return (
                <div key={row.key} className="flex items-center justify-between gap-2">
                  <span className="text-on-surface-muted">{row.name}</span>
                  <span className={`inline-flex items-center gap-1 ${toneClass(status.tone)}`}>
                    <Icon className="h-3 w-3" />
                    {loaded ? status.label : 'Checking'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="border-t border-border pt-2 text-[11px] text-on-surface-muted">
            Credential presence is not a live connection test unless marked Live.
          </p>
          <Link
            href="/settings?tab=providers"
            onClick={() => setOpen(false)}
            className="mt-2 block text-center text-[11px] font-medium text-primary hover:underline"
          >
            Open provider settings
          </Link>
        </div>
      )}
    </div>
  );
}
