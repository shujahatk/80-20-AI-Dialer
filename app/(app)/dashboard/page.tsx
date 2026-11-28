'use client';

import React from 'react';
import Link from 'next/link';
import { PhoneCall, Users } from 'lucide-react';
import { PageShell } from '@/components/ui/page-shell';
import { MetricCard } from '@/MINETECH-UI-KIT/components/cards/MetricCard';
import { Button } from '@/components/ui/button';
import { CallTrendChart } from '@/features/dashboard/CallTrendChart';
import { OutcomesDonutChart } from '@/features/dashboard/OutcomesDonutChart';
import { PipelineFunnel } from '@/features/dashboard/PipelineFunnel';
import { ActivityFeed } from '@/features/dashboard/ActivityFeed';
import { useOperationsSummary } from '@/lib/ui/use-operations-summary';
function leadName(lead: { name?: string; full_name?: string }) {
  return lead.name || lead.full_name || 'Prospect';
}
function leadCompany(lead: { company?: string; company_name?: string }) {
  return lead.company || lead.company_name || '—';
}
function dailyTotals(calls: { startedAt?: string }[]) {
  const buckets = new Map<string, number>();
  calls.forEach((call) => {
    if (!call.startedAt) return;
    const date = new Date(call.startedAt);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  const values = Array.from(buckets.values());
  return values.length > 1 ? values : undefined;
}
export default function DashboardPage() {
  const { data, isLoading, updatedAt } = useOperationsSummary();
  const spark = dailyTotals(data.recentCalls);
  const dash = isLoading ? '—' : undefined;
  const outcomeSegments = [
    { name: 'Answered', value: data.answeredCalls, color: 'var(--chart-1)' },
    { name: 'No answer', value: data.noAnswerCalls, color: 'var(--chart-3)' },
    { name: 'Voicemail', value: data.voicemailCalls, color: 'var(--chart-5)' },
    { name: 'Failed', value: data.failedCalls, color: 'var(--chart-4)' },
  ];
  const funnelSteps = [
    { step: 'Leads', count: String(data.totalLeads), percentage: '100%', width: '100%' },
    {
      step: 'Calls',
      count: String(data.totalCalls),
      percentage: data.totalLeads ? `${Math.min(100, Math.round((data.totalCalls / data.totalLeads) * 100))}%` : '0%',
      width: data.totalLeads ? `${Math.min(100, Math.round((data.totalCalls / data.totalLeads) * 100))}%` : '0%',
    },
    {
      step: 'Connected',
      count: String(data.answeredCalls),
      percentage: `${data.answerRate}%`,
      width: `${data.answerRate}%`,
    },
    {
      step: 'Qualified',
      count: String(data.qualifiedLeads),
      percentage: data.totalLeads ? `${Math.min(100, Math.round((data.qualifiedLeads / data.totalLeads) * 100))}%` : '0%',
      width: data.totalLeads ? `${Math.min(100, Math.round((data.qualifiedLeads / data.totalLeads) * 100))}%` : '0%',
    },
  ];

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">RM Group</p>
          <h1 className="page-heading mt-1">Outbound overview</h1>
          <p className="page-description">
            Workspace calling, leads, and campaigns
            {updatedAt ? ` · ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/analytics"><Button variant="outline" size="sm">Analytics</Button></Link>
          <Link href="/workstation"><Button size="sm">Workstation</Button></Link>
        </div>
      </div>

      <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          className="h-full p-4"
          tone="brand"
          title="Total & Eligible Leads"
          value={dash ?? data.totalLeads}
          subtext={`${data.eligibleLeads} callable · ${Math.max(0, data.totalLeads - data.eligibleLeads)} DNC protected`}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <MetricCard
          className="h-full p-4"
          tone="info"
          title="Calls Attempted"
          value={dash ?? data.totalCalls}
          subtext={`${data.answeredCalls} connected (${data.answerRate}%) · ${data.noAnswerCalls} no answer · ${data.busyCalls} busy · ${data.failedCalls} failed`}
          sparklineData={spark}
          icon={<PhoneCall className="h-3.5 w-3.5" />}
        />
        <MetricCard
          className="h-full p-4"
          tone="success"
          title="Qualified Leads"
          value={dash ?? data.qualifiedLeads}
          subtext={`${data.unqualifiedLeads} unqualified · ${data.callbacksCount} callbacks`}
        />
        <MetricCard
          className="h-full p-4"
          title="Campaigns & Emails"
          value={dash ?? `${data.activeCampaigns} Active`}
          subtext={`${data.scheduledCampaigns} scheduled · ${data.emailsDelivered} emails sent · ${data.emailsFailedOrBounced} bounced`}
        />
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <CallTrendChart calls={data.recentCalls} />
        </div>
        <div className="xl:col-span-4">
          <OutcomesDonutChart
            segments={outcomeSegments}
            totalAnalyzed={data.totalCalls}
            centerValue={`${data.answerRate}%`}
            centerLabel="Answered"
          />
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-12">
        <section className="panel p-4 xl:col-span-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-medium leading-5 text-foreground">Recent leads</h2>
              <p className="text-[12px] leading-5 text-muted-foreground">Current workspace contacts</p>
            </div>
            <Link href="/leads" className="text-[12px] font-medium text-primary">View all</Link>
          </div>
          {data.leads.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">{isLoading ? 'Loading leads…' : 'No leads in this workspace yet.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Company</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.slice(0, 6).map((lead) => {
                    const row = lead as typeof lead & { full_name?: string; company_name?: string; phone_e164?: string };
                    return (
                      <tr key={lead.id}>
                        <td>
                          <Link href={`/leads?search=${encodeURIComponent(leadName(row))}`} className="font-medium text-foreground hover:text-primary">
                            {leadName(row)}
                          </Link>
                          <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">{lead.phone || row.phone_e164 || lead.email || 'No contact info'}</span>
                        </td>
                        <td className="text-foreground/80">{leadCompany(row)}</td>
                        <td className="capitalize text-muted-foreground">{String(lead.status || 'new').replaceAll('_', ' ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="flex flex-col gap-3 xl:col-span-5">
          <PipelineFunnel
            layout="stack"
            steps={funnelSteps}
            overallRate={data.totalLeads ? `${Math.round((data.qualifiedLeads / data.totalLeads) * 100)}%` : '0%'}
          />
          <ActivityFeed calls={data.recentCalls} leads={data.leads} campaigns={data.campaigns} />
        </div>
      </div>
    </PageShell>
  );
}
