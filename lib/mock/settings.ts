import type { TelephonyGuardrails } from '@/types';

export const mockTelephonyGuardrails: TelephonyGuardrails = {
  maxConcurrentTrunks: 50,
  activeTrunks: 28,
  enforceTimezoneFilter: true,
  callingHoursStart: '09:00',
  callingHoursEnd: '17:00',
  skipHolidays: true,
  localPresenceEnabled: true,
  totalDidPoolCount: 124,
  amdSensitivity: 'ultra',
  retentionDays: 90,
  humanTakeoverHotkey: '⌘ + SHIFT + W',
  webhookUrl: 'https://api.revmotion.ai/v1/telephony/events/e99a81c',
  webhookStatus: 'ENDPOINT 200 OK',
};

export const mockMediaGatewayStatus = {
  protocol: 'SRTP / TLS 1.3 Active',
  codec: 'Opus 48kHz / G.711u',
  jitterMs: '2.1 ms (P99)',
  packetLoss: '0.002 %',
};

export const mockVoiceClones = [
  {
    id: 'clone_1',
    name: 'Alex Mercer (SaaS SDR Default)',
    description: 'American Male • Conversational Pace 1.05x',
    callsToday: '48 calls today',
    statusColor: 'bg-tertiary',
  },
  {
    id: 'clone_2',
    name: 'Elena Vance (Enterprise Closer)',
    description: 'British Female • Soft Consultative Tone',
    callsToday: '22 calls today',
    statusColor: 'bg-primary',
  },
  {
    id: 'clone_3',
    name: 'Marcus Reed (Technical Architect)',
    description: 'Neutral Male • Deep Resonant Clarity',
    callsToday: 'Standby',
    statusColor: 'bg-on-surface-variant',
  },
];
