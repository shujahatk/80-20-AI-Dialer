import type { FunnelStageData, HeatmapDayData } from '@/services/analytics';

export const primaryAnalyticsKpis = [
  {
    label: 'Total Calls',
    value: '12,480',
    change: '+18.4%',
    subtext: 'vs last 30 days',
    icon: 'call',
    trend: 'up',
  },
  {
    label: 'Connected Calls',
    value: '7,862',
    change: '63.0%',
    subtext: 'pickup rate',
    icon: 'phone_in_talk',
    trend: 'up',
  },
  {
    label: 'Connect Rate',
    value: '63.0%',
    change: '+4.2%',
    subtext: 'above benchmark',
    icon: 'trending_up',
    trend: 'up',
  },
  {
    label: 'Qualified Leads',
    value: '1,842',
    change: '23.4%',
    subtext: 'of connected calls',
    icon: 'verified',
    trend: 'up',
  },
  {
    label: 'Appointments',
    value: '642',
    change: '+14.8%',
    subtext: 'meetings booked',
    icon: 'calendar_month',
    trend: 'up',
  },
  {
    label: 'Conversion Rate',
    value: '5.14%',
    change: '+0.8%',
    subtext: 'overall yield',
    icon: 'percent',
    trend: 'up',
  },
  {
    label: 'Avg Call Duration',
    value: '3m 42s',
    change: 'Optimal',
    subtext: 'target: 3-5m',
    icon: 'timer',
    trend: 'neutral',
  },
];

export const mockCallOutcomes = [
  { outcome: 'Qualified', count: 1842, percent: 23.4, color: 'text-tertiary', bg: 'bg-tertiary' },
  { outcome: 'Interested', count: 1120, percent: 14.2, color: 'text-primary', bg: 'bg-primary' },
  { outcome: 'Callback', count: 890, percent: 11.3, color: 'text-secondary', bg: 'bg-secondary' },
  { outcome: 'Appointment', count: 642, percent: 8.2, color: 'text-tertiary', bg: 'bg-tertiary' },
  { outcome: 'Not Interested', count: 2430, percent: 30.9, color: 'text-on-surface-variant', bg: 'bg-surface-container-highest' },
  { outcome: 'Wrong Contact', count: 520, percent: 6.6, color: 'text-on-surface-variant', bg: 'bg-surface-container-high' },
  { outcome: 'DNC', count: 418, percent: 5.3, color: 'text-error', bg: 'bg-error' },
];

export const mockAnalyticsKpis = {
  conversionYield: {
    rate: '14.4%',
    change: '+2.8%',
    benchmark: 'vs 11.6% bench',
  },
  engagementArc: {
    duration: '3m 48s',
    status: 'Optimal',
    target: 'Curve Target 3.5m',
    breakdown: { intro: '42s', discovery: '2m 10s', close: '56s' },
  },
  tacticalNavigation: {
    resolutionRate: '68.2%',
    resolved: 412,
    total: 604,
    change: '+4.1% MoM',
  },
  acousticEngine: {
    meanLatency: '118ms',
    sla: 'Sub-120ms SLA',
    whisperStt: '24ms',
    claude: '62ms',
    elevenTurbo: '32ms',
  },
};

export const mockAnalyticsFunnel: FunnelStageData[] = [
  {
    stageNumber: 1,
    stageName: 'Connected Pickups (Live Humans)',
    count: 12480,
    conversionPercent: 100.0,
    barPercent: 100,
  },
  {
    stageNumber: 2,
    stageName: 'Opener Passed (First 15s Pitch Retained)',
    count: 9840,
    conversionPercent: 78.8,
    barPercent: 78.8,
  },
  {
    stageNumber: 3,
    stageName: 'BANT Discovery (Pain Points & Stack Validated)',
    count: 5620,
    conversionPercent: 45.0,
    barPercent: 45.0,
  },
  {
    stageNumber: 4,
    stageName: 'Objection Handled (Rebuttal Counter Executed)',
    count: 3830,
    conversionPercent: 30.7,
    barPercent: 30.7,
  },
  {
    stageNumber: 5,
    stageName: 'Meeting Secured (Calendar Invites Dispatched)',
    count: 1798,
    conversionPercent: 14.4,
    barPercent: 14.4,
    highlight: true,
  },
];

export const mockHeatmapMatrix: HeatmapDayData[] = [
  {
    day: 'Mon',
    slots: [
      { hour: '08:00', rate: 7 },
      { hour: '09:00', rate: 12 },
      { hour: '10:00', rate: 21, isPeak: true },
      { hour: '11:00', rate: 18, isPeak: true },
      { hour: '12:00', rate: 9 },
      { hour: '13:00', rate: 11 },
      { hour: '14:00', rate: 19, isPeak: true },
      { hour: '15:00', rate: 19, isPeak: true },
      { hour: '16:00', rate: 14 },
      { hour: '17:00', rate: 8 },
      { hour: '18:00', rate: 6 },
      { hour: '19:00', rate: 5 },
    ],
  },
  {
    day: 'Tue',
    slots: [
      { hour: '08:00', rate: 9 },
      { hour: '09:00', rate: 14 },
      { hour: '10:00', rate: 24, isPeak: true },
      { hour: '11:00', rate: 22, isPeak: true },
      { hour: '12:00', rate: 10 },
      { hour: '13:00', rate: 13 },
      { hour: '14:00', rate: 25, isPeak: true },
      { hour: '15:00', rate: 21, isPeak: true },
      { hour: '16:00', rate: 15 },
      { hour: '17:00', rate: 10 },
      { hour: '18:00', rate: 7 },
      { hour: '19:00', rate: 6 },
    ],
  },
  {
    day: 'Wed',
    slots: [
      { hour: '08:00', rate: 8 },
      { hour: '09:00', rate: 13 },
      { hour: '10:00', rate: 26, isPeak: true },
      { hour: '11:00', rate: 23, isPeak: true },
      { hour: '12:00', rate: 10 },
      { hour: '13:00', rate: 14 },
      { hour: '14:00', rate: 23, isPeak: true },
      { hour: '15:00', rate: 20, isPeak: true },
      { hour: '16:00', rate: 14 },
      { hour: '17:00', rate: 9 },
      { hour: '18:00', rate: 6 },
      { hour: '19:00', rate: 5 },
    ],
  },
  {
    day: 'Thu',
    slots: [
      { hour: '08:00', rate: 10 },
      { hour: '09:00', rate: 15 },
      { hour: '10:00', rate: 28, isPeak: true },
      { hour: '11:00', rate: 25, isPeak: true },
      { hour: '12:00', rate: 8 },
      { hour: '13:00', rate: 13 },
      { hour: '14:00', rate: 27, isPeak: true },
      { hour: '15:00', rate: 22, isPeak: true },
      { hour: '16:00', rate: 16 },
      { hour: '17:00', rate: 12 },
      { hour: '18:00', rate: 7 },
      { hour: '19:00', rate: 5 },
    ],
  },
  {
    day: 'Fri',
    slots: [
      { hour: '08:00', rate: 8 },
      { hour: '09:00', rate: 13 },
      { hour: '10:00', rate: 22, isPeak: true },
      { hour: '11:00', rate: 18, isPeak: true },
      { hour: '12:00', rate: 7 },
      { hour: '13:00', rate: 6 },
      { hour: '14:00', rate: 15 },
      { hour: '15:00', rate: 11 },
      { hour: '16:00', rate: 6 },
      { hour: '17:00', rate: 5 },
      { hour: '18:00', rate: 4 },
      { hour: '19:00', rate: 3 },
    ],
  },
  {
    day: 'Sat',
    slots: [],
    autoPaused: true,
  },
  {
    day: 'Sun',
    slots: [],
    autoPaused: true,
  },
];

export const mockObjectionsMatrix = [
  {
    objection: '"Already using competitor / Samsara"',
    detectedCalls: 254,
    frequency: '42%',
    navigatedPercent: 71,
    rebuttalCode: 'Rebuttal: Stack Interop #4',
    color: 'tertiary',
  },
  {
    objection: '"Send info via email first"',
    detectedCalls: 169,
    frequency: '28%',
    navigatedPercent: 64,
    rebuttalCode: 'Rebuttal: Micro-Value Hook #2',
    color: 'primary',
  },
  {
    objection: '"Budget freeze / Q4 evaluation"',
    detectedCalls: 109,
    frequency: '18%',
    navigatedPercent: 58,
    rebuttalCode: 'Rebuttal: Zero-Risk POC #1',
    color: 'secondary',
  },
  {
    objection: '"Not the decision maker"',
    detectedCalls: 72,
    frequency: '12%',
    navigatedPercent: 82,
    rebuttalCode: 'Rebuttal: Org Map Discovery',
    color: 'tertiary',
  },
];

export const mockVoiceProsody = {
  receptive: 64,
  neutral: 24,
  defensive: 12,
  wer: '0.6%',
  snr: '99.2 dB SNR',
  cutoffMs: '42ms Cutoff',
};

export const mockCampaignLeaderboard = [
  {
    rank: 1,
    name: 'Inbound Demo Triage',
    desc: 'High-Intent Fast Dial • 1,240 dials',
    conversionRate: '29.4%',
    bookedCount: 364,
  },
  {
    rank: 2,
    name: 'Enterprise Freight Q3',
    desc: 'Mid-to-Large Tier Fleets • 6,400 dials',
    conversionRate: '18.2%',
    bookedCount: 1164,
  },
  {
    rank: 3,
    name: 'Mid-Market Logistics Outbound',
    desc: 'Cold Cold Outreach • 4,840 dials',
    conversionRate: '14.1%',
    bookedCount: 682,
  },
];
