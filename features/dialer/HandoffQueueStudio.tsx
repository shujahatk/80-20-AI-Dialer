'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/lib/ui/icons';

const mockHandoffRequests = [
  {
    id: 'ho_101',
    leadName: 'David Vance',
    company: 'Apex Carrier Ltd',
    phone: '+1 (206) 555-0199',
    reason: 'Explicit quote request for 40+ trailer drop & hook placement',
    aiSummary: 'Prospect qualified on volume (>500 tons/mo). Requested human specialist to negotiate rebate tiers.',
    waitingTime: '00:42',
    agentName: 'Rachel (AI Outbound)',
    sentiment: 'Positive (Receptive)',
  },
  {
    id: 'ho_102',
    leadName: 'Elena Rostova',
    company: 'Titan Supply Corp',
    phone: '+1 (312) 402-9981',
    reason: 'Technical compliance review on hazardous scrap certification',
    aiSummary: 'Gatekeeper passed. Decision maker wants compliance documents before signing contract.',
    waitingTime: '01:15',
    agentName: 'Rachel (AI Outbound)',
    sentiment: 'Neutral (Analytical)',
  },
  {
    id: 'ho_103',
    leadName: 'Thomas Wright',
    company: 'Atlanta Express Hauling',
    phone: '+1 (404) 555-0188',
    reason: 'Direct live transfer requested during AI introduction',
    aiSummary: 'Prospect answered and asked to speak directly with regional account manager.',
    waitingTime: '02:08',
    agentName: 'Rachel (AI Outbound)',
    sentiment: 'Urgent',
  },
];

export const HandoffQueueStudio: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-background min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-[1400px] w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <Link
              href="/workstation"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              <Icon name="arrow_back" size={16} />
              <span>Back to Active Workstation</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2.5">
              <Icon name="forum" size={26} className="text-primary" />
              <span>Human Handoffs Queue</span>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                {mockHandoffRequests.length} Active Requests
              </span>
            </h1>
            <p className="text-sm text-on-surface-variant">
              Live transfer escalations from AI voice calls requiring human sales engineer intervention.
            </p>
          </div>
        </div>

        {/* Handoff Requests */}
        <div className="flex flex-col gap-4">
          {mockHandoffRequests.map((ho) => (
            <div
              key={ho.id}
              className="p-5 rounded-xl bg-surface border border-border flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col gap-2 max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                  <h3 className="text-lg font-bold text-on-surface">{ho.leadName}</h3>
                  <span className="text-xs text-on-surface-variant font-medium">({ho.company})</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-elevated text-on-surface border border-border">
                    {ho.phone}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <div className="text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="text-primary font-mono uppercase">Escalation Trigger:</span>
                    <span>{ho.reason}</span>
                  </div>
                  <div className="text-on-surface-variant bg-surface-elevated p-2.5 rounded-md border border-border/60">
                    <span className="font-semibold text-on-surface">AI Summary: </span>
                    {ho.aiSummary}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-on-surface-variant pt-1">
                  <span>Sentiment: <strong className="text-on-surface">{ho.sentiment}</strong></span>
                  <span>Origin: <strong className="text-on-surface">{ho.agentName}</strong></span>
                  <span className="text-warning font-semibold">Waiting: {ho.waitingTime}</span>
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-end gap-2 shrink-0">
                <Link
                  href="/workstation"
                  className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary-hover flex items-center gap-2 shadow-md"
                >
                  <Icon name="phone" size={16} />
                  <span>Accept Live Transfer</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
