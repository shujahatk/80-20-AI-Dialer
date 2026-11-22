'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function DashboardCommandHeader({
  leadCount,
  callCount,
  campaignCount,
  updatedAt,
}: {
  leadCount: number;
  callCount: number;
  campaignCount: number;
  updatedAt?: Date | null;
}) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'attention'>('checking');
  const [mode, setMode] = useState<string>('development');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/providers/status')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setMode(String(json.data?.mode || 'development'));
        const providers = json.data?.providers || {};
        const ready = ['retell', 'supabase'].every((key) => {
          const value = String(providers[key] || '').toLowerCase();
          return value === 'configured' || value === 'connected' || value === 'healthy';
        });
        setStatus(ready ? 'ready' : 'attention');
      })
      .catch(() => {
        if (!cancelled) setStatus('attention');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-headline text-[18px] font-semibold tracking-tight text-on-surface">Operations</h1>
        <Badge tone={status === 'ready' ? 'success' : status === 'checking' ? 'neutral' : 'warning'}>
          {status === 'ready' ? 'Systems ready' : status === 'checking' ? 'Checking providers' : 'Review configuration'}
        </Badge>
        <Badge tone="info">{mode}</Badge>
        <p className="text-[13px] text-on-surface-variant">
          {leadCount} {leadCount === 1 ? 'lead' : 'leads'} · {callCount} {callCount === 1 ? 'call' : 'calls'} · {campaignCount} {campaignCount === 1 ? 'campaign' : 'campaigns'}
          {updatedAt ? (
            <span className="ml-2 font-mono text-[12px] text-on-surface-muted">
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/analytics">
          <Button variant="secondary" size="sm">Open analytics</Button>
        </Link>
        <Link href="/workstation">
          <Button size="sm">Open workstation</Button>
        </Link>
      </div>
    </div>
  );
}
