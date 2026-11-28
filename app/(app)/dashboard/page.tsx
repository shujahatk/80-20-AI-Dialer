'use client';

import React from 'react';
import Link from 'next/link';
import {
  PhoneCall,
  Users,
  Megaphone,
  BadgeCheck,
  CalendarClock,
  Mail,
  ArrowUpRight,
} from 'lucide-react';
import { PageShell } from '@/components/ui/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOperationsSummary } from '@/lib/ui/use-operations-summary';
import { formatDuration } from '@/lib/ui/operations-summary';
import { leadStatusLabel, leadStatusTone, callOutcomeLabel, callOutcomeTone } from '@/lib/ui/status';

function leadName(lead: { name?: string; full_name?: string }) {
  return lead.name || lead.full_name || 'Prospect';
}

function leadCompany(lead: { company?: string; company_name?: string }) {
  return lead.company || lead.company_name || '—';
}

export default function DashboardPage() {
  const { data, isLoading, updatedAt } = useOperationsSummary();
  const dash = isLoading ? '—' : undefined;

  const kpiCards = [
    {
      title: 'Total Leads',
      value: dash ?? data.totalLeads.toLocaleString(),
      subtext: `${data.eligibleLeads.toLocaleString()} callable · ${Math.max(0, data.totalLeads - data.eligibleLeads)} DNC`,
      icon: Users,
      href: '/leads',
      accent: 'text-on-surface',
    },
    {
      title: 'Active Campaigns',
      value: dash ?? data.activeCampaigns,
      subtext: `${data.scheduledCampaigns} scheduled · ${data.campaigns.length} total`,
      icon: Megaphone,
      href: '/campaigns',
      accent: 'text-primary',
    },
    {
      title: 'Calls Completed',
      value: dash ?? data.totalCalls.toLocaleString(),
      subtext: `${data.answeredCalls} connected (${data.answerRate}%) · ${data.noAnswerCalls} no answer`,
      icon: PhoneCall,
      href: '/calls',
      accent: 'text-on-surface',
    },
    {
      title: 'Qualified Leads',
      value: dash ?? data.qualifiedLeads.toLocaleString(),
      subtext: `${data.unqualifiedLeads} unqualified · Claude verified`,
      icon: BadgeCheck,
      href: '/leads?status=qualified',
      accent: 'text-primary',
    },
    {
      title: 'Pending Callbacks',
      value: dash ?? data.callbacksCount,
      subtext: 'Scheduled follow-up requests',
      icon: CalendarClock,
      href: '/workstation?tab=callbacks',
      accent: 'text-on-surface',
    },
    {
      title: 'Email Delivery',
      value: dash ?? data.emailsDelivered,
      subtext: `Qualified emails sent · ${data.emailsFailedOrBounced} bounced`,
      icon: Mail,
      href: '/settings',
      accent: 'text-primary',
    },
  ];

  return (
    <PageShell wide>
      {/* Clean Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-heading">Dashboard</h1>
          <p className="page-description">
            Real-time outbound calling, qualification, and campaign execution overview
            {updatedAt ? ` · Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/leads">
            <Button variant="outline" size="sm">
              Manage Leads
            </Button>
          </Link>
          <Link href="/campaigns">
            <Button size="sm">Campaigns</Button>
          </Link>
        </div>
      </div>

      {/* 6 Core Operational Metrics Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[12px] font-medium">{card.title}</span>
                <IconComponent className="h-3.5 w-3.5 text-on-surface-muted transition-colors group-hover:text-primary" />
              </div>
              <div className="mt-2">
                <div className={`font-mono text-[22px] font-semibold leading-tight tabular-nums ${card.accent}`}>
                  {card.value}
                </div>
                <p className="mt-1 truncate text-[11.5px] text-on-surface-variant">{card.subtext}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Operational Workspace: Campaign Progress & Recent Call Activity */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* Campaign Progress Section (7 cols) */}
        <section className="rounded-lg border border-border bg-surface p-4 xl:col-span-7">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
            <div>
              <h2 className="text-[13.5px] font-semibold text-on-surface">Campaign Progress</h2>
              <p className="text-[12px] text-on-surface-variant">
                Active, scheduled, and recent outbound calling programs
              </p>
            </div>
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            >
              <span>All Campaigns</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-[12.5px] text-on-surface-variant">
              Loading campaigns...
            </div>
          ) : data.campaigns.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-on-surface-variant">
              No campaigns created yet. Create a campaign to begin autonomous calling.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Connected</th>
                    <th>Qualified</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.slice(0, 6).map((camp) => {
                    const connected = camp.detailedMetrics?.connected ?? camp.stats?.connectedPickups ?? 0;
                    const qualified = camp.detailedMetrics?.qualified ?? camp.stats?.aiQualified ?? 0;
                    const isRunning = camp.status === 'running' || camp.status === 'live';
                    const isScheduled = camp.status === 'scheduled';
                    const isPaused = camp.status === 'paused';

                    return (
                      <tr key={camp.id}>
                        <td>
                          <Link
                            href="/campaigns"
                            className="font-medium text-on-surface hover:text-primary"
                          >
                            {camp.name}
                          </Link>
                          <div className="text-[11px] text-on-surface-muted">
                            {camp.completedLeads} / {camp.leadCount} leads processed
                          </div>
                        </td>
                        <td>
                          <Badge
                            tone={
                              isRunning
                                ? 'success'
                                : isScheduled
                                  ? 'info'
                                  : isPaused
                                    ? 'warning'
                                    : 'neutral'
                            }
                          >
                            {camp.status}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex w-28 items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, camp.progressPercent || 0)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11.5px] tabular-nums text-on-surface-variant">
                              {camp.progressPercent || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="font-mono text-[12.5px] tabular-nums text-on-surface">
                          {connected}
                        </td>
                        <td className="font-mono text-[12.5px] font-semibold tabular-nums text-primary">
                          {qualified}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Call Activity Section (5 cols) */}
        <section className="rounded-lg border border-border bg-surface p-4 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
            <div>
              <h2 className="text-[13.5px] font-semibold text-on-surface">Recent Call Activity</h2>
              <p className="text-[12px] text-on-surface-variant">
                Latest Retell outbound calls and qualification outcomes
              </p>
            </div>
            <Link
              href="/calls"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            >
              <span>Call History</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-[12.5px] text-on-surface-variant">
              Loading recent calls...
            </div>
          ) : data.recentCalls.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-on-surface-variant">
              No outbound calls recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.recentCalls.slice(0, 6).map((call) => (
                <div key={call.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-on-surface">
                      {call.leadName}
                    </div>
                    <div className="truncate text-[11.5px] text-on-surface-variant">
                      {call.company !== '—' ? `${call.company} · ` : ''}
                      <span className="font-mono">{formatDuration(call.durationSeconds)}</span>
                      {call.startedAt ? ` · ${new Date(call.startedAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <Badge tone={callOutcomeTone(call.outcome)}>
                    {callOutcomeLabel(call.outcome)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Leads Table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
          <div>
            <h2 className="text-[13.5px] font-semibold text-on-surface">Recent CRM Leads</h2>
            <p className="text-[12px] text-on-surface-variant">
              Latest contacts added or updated in your workspace
            </p>
          </div>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            <span>View All Leads</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-[12.5px] text-on-surface-variant">
            Loading leads...
          </div>
        ) : data.leads.length === 0 ? (
          <div className="py-8 text-center text-[12.5px] text-on-surface-variant">
            No leads in this workspace yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Campaign</th>
                  <th>Qualification</th>
                  <th>Last Call</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.slice(0, 6).map((lead) => {
                  const row = lead as typeof lead & { full_name?: string; company_name?: string; phone_e164?: string };
                  return (
                    <tr key={lead.id}>
                      <td>
                        <Link
                          href={`/leads?search=${encodeURIComponent(leadName(row))}`}
                          className="font-medium text-on-surface hover:text-primary"
                        >
                          {leadName(row)}
                        </Link>
                      </td>
                      <td className="text-on-surface-variant">{leadCompany(row)}</td>
                      <td className="font-mono text-[12px] text-on-surface-variant">
                        {lead.phone || row.phone_e164 || lead.email || '—'}
                      </td>
                      <td className="text-[12px] text-on-surface-variant">
                        {lead.campaignName || '—'}
                      </td>
                      <td>
                        <Badge tone={leadStatusTone(lead.status)}>
                          {leadStatusLabel(lead.status)}
                        </Badge>
                      </td>
                      <td className="text-[12px] text-on-surface-variant">
                        {lead.lastOutcome || 'Not contacted'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
