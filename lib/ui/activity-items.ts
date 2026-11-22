import type { Campaign, Lead } from '@/types';
import type { OperationsCall } from './operations-summary';

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  href?: string;
}

function formatWhen(value?: string) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function buildActivityItems(input: {
  calls?: OperationsCall[];
  leads?: Lead[];
  campaigns?: Campaign[];
  limit?: number;
}): ActivityItem[] {
  const calls = input.calls || [];
  const leads = input.leads || [];
  const campaigns = input.campaigns || [];
  const limit = input.limit ?? 7;

  return [
    ...calls.slice(0, 5).map((call) => ({
      id: `call-${call.id}`,
      title: `Call ${call.outcomeLabel || call.status}`,
      detail: `${call.leadName} · ${call.company}`,
      time: formatWhen(call.startedAt),
      href: '/calls',
    })),
    ...campaigns
      .filter((campaign) => campaign.status === 'running' || campaign.status === 'live')
      .slice(0, 2)
      .map((campaign) => ({
        id: `camp-${campaign.id}`,
        title: 'Campaign running',
        detail: campaign.name,
        time: campaign.status,
        href: '/campaigns',
      })),
    ...leads
      .filter((lead) => lead.status === 'qualified' || lead.status === 'meeting-booked')
      .slice(0, 2)
      .map((lead) => ({
        id: `lead-${lead.id}`,
        title: lead.status === 'meeting-booked' ? 'Lead converted' : 'Lead qualified',
        detail: `${lead.name} · ${lead.company}`,
        time: lead.lastCallDate || lead.status,
        href: '/leads',
      })),
  ].slice(0, limit);
}
