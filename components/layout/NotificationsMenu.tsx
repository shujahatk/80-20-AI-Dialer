'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { buildActivityItems, type ActivityItem } from '@/lib/ui/activity-items';
import type { Campaign, Lead } from '@/types';
import type { OperationsCall } from '@/lib/ui/operations-summary';

function mapCall(raw: Record<string, unknown>): OperationsCall {
  const lead = (raw.lead as Record<string, unknown> | undefined) || {};
  return {
    id: String(raw.id),
    leadName: String(lead.full_name || raw.lead_name || 'Unknown lead'),
    company: String(lead.company_name || raw.company || '—'),
    phone: String(lead.phone_e164 || lead.phone || raw.phone || '—'),
    agentName: String(raw.agent_name || 'RM AI Agent'),
    outcome: String(raw.outcome || raw.status || 'completed'),
    outcomeLabel: String(raw.outcome || raw.status || 'Completed'),
    status: String(raw.status || 'completed'),
    durationSeconds: Number(raw.duration_seconds) || 0,
    startedAt: raw.started_at ? String(raw.started_at) : undefined,
  };
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setOpen((prev) => !prev);
    if (loaded) return;
    try {
      const [callsRes, campaignsRes, leadsRes] = await Promise.all([
        fetch('/api/calls?limit=5'),
        fetch('/api/campaigns?limit=5'),
        fetch('/api/leads?limit=10'),
      ]);
      const [callsJson, campaignsJson, leadsJson] = await Promise.all([
        callsRes.json(),
        campaignsRes.json(),
        leadsRes.json(),
      ]);
      const calls = Array.isArray(callsJson.data) ? callsJson.data.map(mapCall) : [];
      const campaigns: Campaign[] = Array.isArray(campaignsJson.data) ? campaignsJson.data : [];
      const leads: Lead[] = Array.isArray(leadsJson.data) ? leadsJson.data : [];
      setItems(buildActivityItems({ calls, campaigns, leads, limit: 6 }));
      setLoaded(true);
    } catch {
      setItems([]);
      setLoaded(true);
    }
  };

  return (
    <div className="relative">
      <button
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-on-surface-variant transition-colors duration-fast hover:bg-muted hover:text-on-surface"
        type="button"
        aria-label="View notifications"
        aria-expanded={open}
        onClick={load}
      >
        <Bell className="h-4 w-4" />
        {loaded && items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-success" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg rm-panel">
          <div className="border-b border-border px-3 py-2 text-[12px] font-semibold text-on-surface">Operational events</div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-on-surface-variant">No new operational events.</div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.href || '/dashboard'}
                className="block border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-surface-elevated"
                onClick={() => setOpen(false)}
              >
                <div className="text-[13px] font-medium text-on-surface">{item.title}</div>
                <div className="truncate text-[12px] text-on-surface-variant">{item.detail}</div>
                <div className="mt-0.5 font-mono text-[11px] text-on-surface-muted">{item.time}</div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
