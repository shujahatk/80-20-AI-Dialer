'use client';

import React from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { SectionHeader } from '@/components/ui/section-header';
import { ChartFrame } from '@/components/ui/chart-frame';
import { OutcomesDonutChart } from '@/features/dashboard/OutcomesDonutChart';
import { PipelineFunnel } from '@/features/dashboard/PipelineFunnel';
import { CallTrendChart } from '@/features/dashboard/CallTrendChart';
import { HourlyVelocityChart } from '@/features/dashboard/HourlyVelocityChart';
import { useOperationsSummary } from '@/lib/ui/use-operations-summary';
import { formatDuration } from '@/lib/ui/operations-summary';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { InsightCards, type Insight } from '@/components/ui/insight-cards';

export default function AnalyticsPage() {
  const { data, isLoading, updatedAt } = useOperationsSummary();

  const insights: Insight[] = [
    { id: 'calls', label: 'Calls', value: isLoading ? '—' : String(data.totalCalls), note: 'Recorded conversations' },
    { id: 'answer', label: 'Answer rate', value: isLoading ? '—' : `${data.answerRate}%`, note: `${data.answeredCalls} answered` },
    { id: 'duration', label: 'Avg duration', value: isLoading ? '—' : formatDuration(data.avgDurationSeconds), note: 'Across logged calls' },
    { id: 'converted', label: 'Meetings booked', value: isLoading ? '—' : String(data.convertedLeads), note: 'Qualified conversions' },
  ];

  const outcomeSegments = [
    { name: 'Answered', value: data.answeredCalls, color: 'var(--chart-1)' },
    { name: 'No answer', value: data.noAnswerCalls, color: 'var(--chart-3)' },
    { name: 'Voicemail', value: data.voicemailCalls, color: 'var(--chart-5)' },
    { name: 'Failed', value: data.failedCalls, color: 'var(--chart-4)' },
  ];

  return (
    <PageShell>
      <SectionHeader
        title="Telephony & AI analytics"
        description={`Metrics computed from current leads, calls, campaigns, and agents.${
          updatedAt ? ` Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''
        }`}
      />

      <InsightCards insights={insights} layout="strip" />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
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
        <div className="xl:col-span-12">
          <HourlyVelocityChart calls={data.recentCalls} totalCalls={data.totalCalls} />
        </div>
        <div className="xl:col-span-6">
          <PipelineFunnel
            layout="rail"
            steps={[
              { step: 'Leads', count: String(data.totalLeads), percentage: '100%', width: '100%' },
              { step: 'Calls', count: String(data.totalCalls), percentage: `${data.totalCalls}`, width: data.totalLeads ? `${Math.min(100, Math.round((data.totalCalls / data.totalLeads) * 100))}%` : '0%' },
              { step: 'Answered', count: String(data.answeredCalls), percentage: `${data.answerRate}%`, width: `${data.answerRate}%` },
              { step: 'Qualified', count: String(data.qualifiedLeads), percentage: `${data.qualifiedLeads}`, width: data.totalLeads ? `${Math.min(100, Math.round((data.qualifiedLeads / data.totalLeads) * 100))}%` : '0%' },
            ]}
            overallRate={data.totalLeads ? `${Math.round((data.qualifiedLeads / data.totalLeads) * 100)}%` : '0%'}
          />
        </div>
        <div className="xl:col-span-6">
          <ChartFrame title="Campaign performance" description="Progress and conversions from campaign records">
            <div className="flex flex-col gap-2">
              {data.campaigns.slice(0, 6).map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-on-surface">{campaign.name}</div>
                    <div className="text-[12px] text-on-surface-variant">{campaign.agentName || 'Unassigned agent'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{campaign.status}</Badge>
                    <span className="text-[12px] tabular-nums text-on-surface">
                      {campaign.stats?.connectedPickups ?? campaign.detailedMetrics?.connected ?? 0} answered
                    </span>
                  </div>
                </div>
              ))}
              {data.campaigns.length === 0 && (
                <div className="py-8 text-center text-[13px] text-on-surface-variant">No campaign metrics yet.</div>
              )}
            </div>
          </ChartFrame>
        </div>
      </div>

      <Card className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <div className="text-[12px] text-on-surface-variant">Hot leads</div>
          <div className="text-[20px] font-semibold">{data.hotLeads}</div>
        </div>
        <div>
          <div className="text-[12px] text-on-surface-variant">Warm leads</div>
          <div className="text-[20px] font-semibold">{data.warmLeads}</div>
        </div>
        <div>
          <div className="text-[12px] text-on-surface-variant">Cold leads</div>
          <div className="text-[20px] font-semibold">{data.coldLeads}</div>
        </div>
        <div>
          <div className="text-[12px] text-on-surface-variant">Active agents</div>
          <div className="text-[20px] font-semibold">{data.agents.length}</div>
        </div>
      </Card>
    </PageShell>
  );
}
