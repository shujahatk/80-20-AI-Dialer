import type { Campaign, Lead } from '@/types';
import { classifyCallBucket } from './status';

export interface OperationsCall {
  id: string;
  leadName: string;
  company: string;
  phone: string;
  agentName: string;
  outcome: string;
  outcomeLabel: string;
  status: string;
  durationSeconds: number;
  startedAt?: string;
  sentimentLabel?: string;
}

export interface OperationsAgent {
  id: string;
  name: string;
  status?: string;
  stage_state?: string;
  role?: string;
}

export interface OperationsSummary {
  totalLeads: number;
  eligibleLeads: number;
  qualifiedLeads: number;
  unqualifiedLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  totalCalls: number;
  answeredCalls: number;
  noAnswerCalls: number;
  busyCalls: number;
  voicemailCalls: number;
  failedCalls: number;
  answerRate: number;
  avgDurationSeconds: number;
  activeCampaigns: number;
  scheduledCampaigns: number;
  convertedLeads: number;
  interestedLeads: number;
  callbacksCount: number;
  emailsDelivered: number;
  emailsFailedOrBounced: number;
  recentCalls: OperationsCall[];
  campaigns: Campaign[];
  agents: OperationsAgent[];
  leads: Lead[];
}

export function emptyOperationsSummary(): OperationsSummary {
  return {
    totalLeads: 0,
    eligibleLeads: 0,
    qualifiedLeads: 0,
    unqualifiedLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    totalCalls: 0,
    answeredCalls: 0,
    noAnswerCalls: 0,
    busyCalls: 0,
    voicemailCalls: 0,
    failedCalls: 0,
    answerRate: 0,
    avgDurationSeconds: 0,
    activeCampaigns: 0,
    scheduledCampaigns: 0,
    convertedLeads: 0,
    interestedLeads: 0,
    callbacksCount: 0,
    emailsDelivered: 0,
    emailsFailedOrBounced: 0,
    recentCalls: [],
    campaigns: [],
    agents: [],
    leads: [],
  };
}

export function buildOperationsSummary(input: {
  leads: Lead[];
  leadTotal?: number;
  leadMetrics?: { totalLeads?: number; qualified?: number; dncRestricted?: number };
  calls: OperationsCall[];
  campaigns: Campaign[];
  agents: OperationsAgent[];
  callbacksCount?: number;
  emailCounts?: { delivered?: number; accepted?: number; bounced?: number; failed?: number };
}): OperationsSummary {
  const leads = input.leads || [];
  const calls = input.calls || [];
  const campaigns = input.campaigns || [];
  const agents = input.agents || [];

  const buckets = { answered: 0, no_answer: 0, voicemail: 0, failed: 0 };
  let busyCalls = 0;
  let durationTotal = 0;
  calls.forEach((call) => {
    const outLower = `${call.outcome} ${call.status}`.toLowerCase();
    if (outLower.includes('busy')) {
      busyCalls += 1;
    }
    buckets[classifyCallBucket(call.outcome, call.status)] += 1;
    durationTotal += call.durationSeconds || 0;
  });

  const totalCalls = calls.length;
  const totalLeads = input.leadTotal ?? input.leadMetrics?.totalLeads ?? leads.length;
  const dncCount =
    input.leadMetrics?.dncRestricted ??
    leads.filter((l) => l.status === 'dnc' || l.isDnc).length;
  const eligibleLeads = Math.max(0, totalLeads - dncCount);

  const qualifiedLeads =
    input.leadMetrics?.qualified ??
    leads.filter((lead) => lead.status === 'qualified' || lead.status === 'meeting-booked' || lead.status === 'converted').length;

  const unqualifiedLeads = leads.filter(
    (lead) => lead.status === 'unqualified' || lead.status === 'unreachable' || lead.status === 'Not Interested'
  ).length;

  const callbacksCount =
    input.callbacksCount ??
    leads.filter((lead) => lead.status === 'callback' || lead.status === 'callback-scheduled').length;

  const emailsDelivered =
    (input.emailCounts?.delivered ?? 0) || (input.emailCounts?.accepted ?? 0);
  const emailsFailedOrBounced =
    (input.emailCounts?.bounced ?? 0) + (input.emailCounts?.failed ?? 0);

  return {
    totalLeads,
    eligibleLeads,
    qualifiedLeads,
    unqualifiedLeads,
    hotLeads: leads.filter((lead) => lead.priority === 'high').length,
    warmLeads: leads.filter((lead) => !lead.priority || lead.priority === 'medium').length,
    coldLeads: leads.filter((lead) => lead.priority === 'low').length,
    totalCalls,
    answeredCalls: buckets.answered,
    noAnswerCalls: Math.max(0, buckets.no_answer - busyCalls),
    busyCalls,
    voicemailCalls: buckets.voicemail,
    failedCalls: buckets.failed,
    answerRate: totalCalls ? Math.round((buckets.answered / totalCalls) * 100) : 0,
    avgDurationSeconds: totalCalls ? Math.round(durationTotal / totalCalls) : 0,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === 'running' || campaign.status === 'live').length,
    scheduledCampaigns: campaigns.filter((campaign) => campaign.status === 'scheduled').length,
    convertedLeads: leads.filter((lead) => lead.status === 'meeting-booked' || lead.status === 'converted').length,
    interestedLeads: leads.filter((lead) => lead.status === 'objection-handled' || lead.status === 'qualified').length,
    callbacksCount,
    emailsDelivered,
    emailsFailedOrBounced,
    recentCalls: calls.slice(0, 8),
    campaigns,
    agents,
    leads,
  };
}

export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}
