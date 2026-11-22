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
  qualifiedLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  totalCalls: number;
  answeredCalls: number;
  noAnswerCalls: number;
  voicemailCalls: number;
  failedCalls: number;
  answerRate: number;
  avgDurationSeconds: number;
  activeCampaigns: number;
  convertedLeads: number;
  interestedLeads: number;
  recentCalls: OperationsCall[];
  campaigns: Campaign[];
  agents: OperationsAgent[];
  leads: Lead[];
}

export function emptyOperationsSummary(): OperationsSummary {
  return {
    totalLeads: 0,
    qualifiedLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    totalCalls: 0,
    answeredCalls: 0,
    noAnswerCalls: 0,
    voicemailCalls: 0,
    failedCalls: 0,
    answerRate: 0,
    avgDurationSeconds: 0,
    activeCampaigns: 0,
    convertedLeads: 0,
    interestedLeads: 0,
    recentCalls: [],
    campaigns: [],
    agents: [],
    leads: [],
  };
}

export function buildOperationsSummary(input: {
  leads: Lead[];
  leadTotal?: number;
  leadMetrics?: { totalLeads?: number; qualified?: number };
  calls: OperationsCall[];
  campaigns: Campaign[];
  agents: OperationsAgent[];
}): OperationsSummary {
  const leads = input.leads || [];
  const calls = input.calls || [];
  const campaigns = input.campaigns || [];
  const agents = input.agents || [];

  const buckets = { answered: 0, no_answer: 0, voicemail: 0, failed: 0 };
  let durationTotal = 0;
  calls.forEach((call) => {
    buckets[classifyCallBucket(call.outcome, call.status)] += 1;
    durationTotal += call.durationSeconds || 0;
  });

  const totalCalls = calls.length;
  const qualifiedLeads =
    input.leadMetrics?.qualified ??
    leads.filter((lead) => lead.status === 'qualified' || lead.status === 'meeting-booked').length;

  return {
    totalLeads: input.leadTotal ?? input.leadMetrics?.totalLeads ?? leads.length,
    qualifiedLeads,
    hotLeads: leads.filter((lead) => lead.priority === 'high').length,
    warmLeads: leads.filter((lead) => !lead.priority || lead.priority === 'medium').length,
    coldLeads: leads.filter((lead) => lead.priority === 'low').length,
    totalCalls,
    answeredCalls: buckets.answered,
    noAnswerCalls: buckets.no_answer,
    voicemailCalls: buckets.voicemail,
    failedCalls: buckets.failed,
    answerRate: totalCalls ? Math.round((buckets.answered / totalCalls) * 100) : 0,
    avgDurationSeconds: totalCalls ? Math.round(durationTotal / totalCalls) : 0,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === 'running' || campaign.status === 'live').length,
    convertedLeads: leads.filter((lead) => lead.status === 'meeting-booked').length,
    interestedLeads: leads.filter((lead) => lead.status === 'objection-handled' || lead.status === 'qualified').length,
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
