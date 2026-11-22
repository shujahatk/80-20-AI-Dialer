'use client';

import React, { useState, useEffect } from 'react';
import type { ProviderAuditResult, ProviderStatus } from '@/lib/env';
import { Icon } from '@/lib/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';

type DisplayStatus = 'Connected' | 'Configured' | 'Not verified' | 'Missing Configuration' | 'Error' | 'Unavailable';

function toDisplayStatus(status?: ProviderStatus): DisplayStatus {
  if (!status) return 'Unavailable';
  if (status === 'Configured') return 'Configured';
  if (status === 'Untested') return 'Not verified';
  if (status === 'Missing') return 'Missing Configuration';
  return 'Error';
}

function statusClasses(status: DisplayStatus) {
  switch (status) {
    case 'Connected':
      return 'bg-success-surface text-success border-success/20';
    case 'Configured':
      return 'bg-info-surface text-info border-info/20';
    case 'Not verified':
      return 'bg-surface-secondary text-on-surface-variant border-border';
    case 'Missing Configuration':
      return 'bg-warning-surface text-warning border-warning/20';
    case 'Error':
      return 'bg-error-surface text-error border-error/20';
    default:
      return 'bg-surface-secondary text-on-surface-variant border-border';
  }
}

export function ProviderGatewayCards() {
  const [showTechnical, setShowTechnical] = useState(false);
  const [audit, setAudit] = useState<ProviderAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await fetch('/api/providers/audit');
        const json = await res.json();
        if (json.success && json.data) {
          setAudit(json.data);
        }
      } catch (err) {
        console.warn('Could not fetch provider audit status', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAudit();
  }, []);

  const providers = [
    {
      id: 'retell',
      name: 'Retell AI',
      role: 'AI Voice Runtime',
      description: 'Conversational speech, turn-taking, and outbound AI calling.',
      icon: 'smart_toy',
      status: toDisplayStatus(audit?.retell),
    },
    {
      id: 'twilio',
      name: 'Twilio',
      role: 'PSTN Carrier & WebRTC',
      description: 'Carrier routing, registered numbers, and browser dialer audio.',
      icon: 'call',
      status: toDisplayStatus(audit?.twilio),
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      role: 'Intelligence Model',
      description: 'Conversation reasoning, qualification, and CRM tool use.',
      icon: 'psychology',
      status: toDisplayStatus(audit?.anthropic),
    },
    {
      id: 'supabase',
      name: 'Supabase',
      role: 'Database & Security',
      description: 'Contacts, campaigns, transcripts, analytics, and tenant isolation.',
      icon: 'database',
      status: toDisplayStatus(audit?.supabase),
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {providers.map((p) => (
          <div
            key={p.id}
            className="flex flex-col justify-between rounded-xl border border-black/[0.07] bg-white p-5 transition-colors duration-200 hover:border-primary/30 dark:border-white/[0.08] dark:bg-[#121614]"
          >
            <div>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
                    <Icon name={p.icon} size={20} />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-[15px] font-semibold text-on-surface">{p.name}</h3>
                    <span className="text-[12px] text-on-surface-variant">{p.role}</span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold border ${statusClasses(p.status)}`}>
                  {p.status}
                </span>
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-on-surface-variant">{p.description}</p>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-[12px] text-on-surface-variant">
                {audit?.mode ? `${audit.mode} mode` : 'Status from environment'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setShowTechnical(!showTechnical)}
          className="flex w-full items-center justify-between bg-surface-elevated p-4 text-[14px] font-semibold text-on-surface transition-colors hover:bg-surface-secondary"
        >
          <span className="flex items-center gap-2">
            <Icon name="tune" size={18} className="text-primary" />
            <span>Configuration details</span>
          </span>
          <Icon name={showTechnical ? 'expand_less' : 'expand_more'} size={20} className="text-on-surface-variant" />
        </button>

        {showTechnical && (
          <div className="grid grid-cols-1 gap-3 border-t border-border p-5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface-elevated p-3">
              <span className="block text-[11px] font-medium text-on-surface-variant">AI voice runtime</span>
              <span className="font-semibold capitalize text-on-surface">{audit?.aiVoiceRuntime || '—'}</span>
            </div>
            <div className="rounded-lg border border-border bg-surface-elevated p-3">
              <span className="block text-[11px] font-medium text-on-surface-variant">Retell API key</span>
              <span className="font-semibold text-on-surface">
                {audit?.details.retellKeyConfigured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-surface-elevated p-3">
              <span className="block text-[11px] font-medium text-on-surface-variant">Retell webhook secret</span>
              <span className="font-semibold text-on-surface">
                {audit?.details.retellWebhookSecretConfigured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-surface-elevated p-3">
              <span className="block text-[11px] font-medium text-on-surface-variant">Twilio account</span>
              <span className="font-semibold text-on-surface">
                {audit?.details.twilioSidConfigured ? 'Configured' : 'Not configured'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
