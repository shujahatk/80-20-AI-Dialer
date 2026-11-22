import type { DashboardMetric, Callback } from '@/types';

export const mockDashboardMetrics: DashboardMetric[] = [
  {
    id: 'calls_today',
    title: 'Calls Today',
    value: '1,482',
    changePercent: 14.2,
    trend: 'up',
    subtext: '+184 vs yesterday',
    icon: 'phone_in_talk',
    color: 'primary',
    sparklinePoints: [20, 17, 19, 11, 14, 8, 10, 4],
  },
  {
    id: 'connected_calls',
    title: 'Connected Calls',
    value: '892',
    changePercent: 8.5,
    trend: 'up',
    subtext: '60.2% connection rate',
    icon: 'call_received',
    color: 'tertiary',
    sparklinePoints: [18, 16, 20, 10, 12, 6, 2],
  },
  {
    id: 'qualified_leads',
    title: 'Qualified Leads',
    value: '142',
    changePercent: 12.3,
    trend: 'up',
    subtext: 'B2B decision makers',
    icon: 'verified',
    color: 'primary',
    sparklinePoints: [16, 14, 9, 11, 4],
  },
  {
    id: 'callbacks',
    title: 'Callbacks',
    value: '24',
    changePercent: 4.0,
    trend: 'neutral',
    subtext: 'Scheduled follow-ups',
    icon: 'schedule',
    color: 'secondary',
    sparklinePoints: [14, 18, 12, 9, 11, 5],
  },
  {
    id: 'appointments',
    title: 'Appointments',
    value: '38',
    changePercent: 18.4,
    trend: 'up',
    subtext: 'Demos & meetings booked',
    icon: 'event_available',
    color: 'tertiary',
    sparklinePoints: [20, 16, 12, 7, 3],
  },
  {
    id: 'conversion_rate',
    title: 'Conversion Rate',
    value: '15.9%',
    changePercent: 2.4,
    trend: 'up',
    subtext: '+2.4% above target',
    icon: 'trending_up',
    color: 'primary',
    sparklinePoints: [16, 15, 13, 11, 12, 7],
  },
];

export interface HourlyVelocityPoint {
  hour: string;
  heightPercent: number;
  label?: string;
  isPeak?: boolean;
  color?: 'primary' | 'tertiary' | 'muted';
}

export const mockHourlyVelocity: HourlyVelocityPoint[] = [
  { hour: '08h', heightPercent: 25, color: 'muted' },
  { hour: '09h', heightPercent: 55, color: 'muted' },
  { hour: '10h', heightPercent: 92, label: '91%', isPeak: true, color: 'primary' },
  { hour: '11h', heightPercent: 86, isPeak: true, color: 'primary' },
  { hour: '12h', heightPercent: 38, color: 'muted' },
  { hour: '13h', heightPercent: 48, color: 'muted' },
  { hour: '14h', heightPercent: 74, label: 'Surge', isPeak: true, color: 'tertiary' },
  { hour: '15h', heightPercent: 62, color: 'muted' },
  { hour: '16h', heightPercent: 42, color: 'muted' },
  { hour: '17h', heightPercent: 20, color: 'muted' },
];

export interface OutcomeDonutSegment {
  name: string;
  percentage: number;
  count: number;
  color: string;
  strokeColor: string;
  dashArray: string;
  dashOffset: string;
}

export const mockOutcomeSegments: OutcomeDonutSegment[] = [
  {
    name: 'Booked Meeting',
    percentage: 14,
    count: 142,
    color: 'bg-primary',
    strokeColor: '#4cd7f6',
    dashArray: '12.31 87.96',
    dashOffset: '-75.64',
  },
  {
    name: 'Qualified Follow-up',
    percentage: 21,
    count: 206,
    color: 'bg-secondary',
    strokeColor: '#c0c1ff',
    dashArray: '18.47 87.96',
    dashOffset: '-28.15',
  },
  {
    name: 'Callback Scheduled',
    percentage: 15,
    count: 148,
    color: 'bg-tertiary',
    strokeColor: '#4edea3',
    dashArray: '13.19 87.96',
    dashOffset: '-62.45',
  },
  {
    name: 'Voicemail Left',
    percentage: 32,
    count: 315,
    color: 'bg-outline',
    strokeColor: '#869397',
    dashArray: '28.15 87.96',
    dashOffset: '0',
  },
  {
    name: 'Not Interested',
    percentage: 18,
    count: 173,
    color: 'bg-error',
    strokeColor: '#ffb4ab',
    dashArray: '15.83 87.96',
    dashOffset: '-46.62',
  },
];

export const mockDashboardFunnel = [
  { step: '1. Imported', count: '1,600', percentage: '100%', width: '100%', color: 'bg-primary-fixed-dim' },
  { step: '2. Dialed', count: '1,482 (92%)', percentage: '92%', width: '92%', color: 'bg-primary' },
  { step: '3. Engaged', count: '892 (60%)', percentage: '60%', width: '60%', color: 'bg-secondary' },
  { step: '4. Qualified', count: '348 (23%)', percentage: '39%', width: '39%', color: 'bg-tertiary-fixed-dim' },
  { step: '5. Booked Meetings', count: '142 (9.6%)', percentage: '25%', width: '25%', color: 'bg-tertiary' },
];

export const mockLiveTelephonyDeck = [
  {
    id: 'live_call_1',
    leadName: 'David Chen',
    leadRole: 'VP Engineering @ CloudScale',
    agentName: 'Agent Rachel (Enterprise)',
    duration: '02:41',
    state: 'in-call',
    avatarLetter: 'R',
    avatarColor: 'text-primary',
    transcriptSnippet: {
      intentScore: 'High Buying Intent (0.89)',
      leadUtterance: '...we currently have 40 seats on Outreach, but latency and conversational latency with AI has been our blocker...',
      agentUtterance: 'Understood, David. Our voice bridge operates at 112ms round-trip, virtually eliminating overlapping talk...',
    },
    audioCodec: 'Audio: G.711u • ElevenLabs v2 Turbo',
  },
  {
    id: 'live_call_2',
    leadName: 'Amanda Miller',
    leadRole: 'Director RevOps @ FinFlow',
    agentName: 'Agent Marcus • Ringing (00:08)',
    duration: '00:08',
    state: 'ringing',
    avatarLetter: 'M',
    avatarColor: 'text-secondary',
    tag: 'Ringing Tier-1',
  },
  {
    id: 'live_call_3',
    leadName: 'Robert Taylor',
    leadRole: 'COO @ NexaHealth',
    agentName: 'Agent Elena • Dropping VM Template B',
    duration: '00:14',
    state: 'amd',
    avatarLetter: 'E',
    avatarColor: 'text-tertiary',
    tag: 'VM Dispatched',
  },
];

export const mockDashboardCallbacks: Callback[] = [
  {
    id: 'cb_1',
    leadId: 'ld_michael',
    leadName: 'Michael Scott',
    leadTitle: 'CTO @ Scranton Paper Tech (PST)',
    company: 'Scranton Paper Tech',
    timezone: 'PST',
    dueIn: 'In 14m',
    dueTimestamp: '14:00',
    assignedAgent: 'Agent Rachel Assigned',
    note: '"Call after board meeting, interested in pricing model"',
  },
  {
    id: 'cb_2',
    leadId: 'ld_sarah',
    leadName: 'Sarah Connor',
    leadTitle: 'VP Security @ Cyberdyne (EST)',
    company: 'Cyberdyne',
    timezone: 'EST',
    dueIn: 'In 42m',
    dueTimestamp: '14:30',
    assignedAgent: 'Agent Marcus Assigned',
    note: '"Requested technical compliance docs verification"',
  },
  {
    id: 'cb_3',
    leadId: 'ld_liam',
    leadName: 'Liam Davies',
    leadTitle: 'Head of Sales @ Vertex (CST)',
    company: 'Vertex',
    timezone: 'CST',
    dueIn: '3:30 PM',
    dueTimestamp: '15:30',
    assignedAgent: 'Agent Elena Assigned',
    note: '"Re-evaluate contract duration"',
  },
];

export const mockAgentLeaderboard = [
  {
    id: 'ag_rachel',
    rank: 1,
    name: 'Rachel',
    modelRole: 'Enterprise Outbound v2',
    avatarColor: 'bg-primary/20 text-primary',
    calls: 642,
    bookingRate: '18.2%',
    latency: '98ms',
  },
  {
    id: 'ag_marcus',
    rank: 2,
    name: 'Marcus',
    modelRole: 'Follow-up & Nurture AI',
    avatarColor: 'bg-secondary/20 text-secondary',
    calls: 514,
    bookingRate: '14.6%',
    latency: '115ms',
  },
  {
    id: 'ag_elena',
    rank: 3,
    name: 'Elena',
    modelRole: 'Inbound Fast Triage',
    avatarColor: 'bg-tertiary/20 text-tertiary',
    calls: 326,
    bookingRate: '11.9%',
    latency: '84ms',
  },
];
