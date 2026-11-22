import type { User, ProviderStatus } from '@/types';

export const mockCurrentUser: User = {
  id: 'usr_sarah_01',
  name: 'Sarah Connor',
  email: 's.connor@rmlogistics.com',
  role: 'sdr',
  title: 'Senior SDR Operator',
  avatarUrl: '/avatars/executive-avatar.png',
  status: 'in-call',
  nodeId: '#4092-B2B',
};

export const mockProviderStatuses: ProviderStatus[] = [
  {
    id: 'twilio',
    name: 'Twilio SIP Trunking',
    tier: 'Carrier Grade Tier-1',
    state: 'connected',
    latencyMs: 24,
    uptimePercent: 99.98,
    activeChannels: 28,
    maxChannels: 50,
    details: 'US-East-1 AWS Cluster (Node 09)',
    extraMeta: {
      codec: 'Opus HD 48kHz',
      didPoolCount: 124,
      jitterMs: 0.4,
    },
  },
  {
    id: 'retell',
    name: 'Retell AI Voice Core',
    tier: 'Enterprise Real-Time Voice',
    state: 'connected',
    latencyMs: 88,
    uptimePercent: 99.98,
    details: 'WebSocket Ultra-Low Latency Bridge',
    extraMeta: {
      p95LatencyMs: 76,
      activeClones: 12,
      customLlmTransport: 'WebSocket Stream',
    },
  },
  {
    id: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    tier: 'Autonomous Reasoning Core',
    state: 'connected',
    latencyMs: 62,
    uptimePercent: 99.99,
    details: 'claude-3-5-sonnet-20241022 (31ms TTFT stream)',
    extraMeta: {
      contextWindow: 4096,
      temperature: 0.2,
      fallbackModel: 'GPT-4o',
    },
  },
  {
    id: 'crm',
    name: 'HubSpot & Salesforce',
    tier: 'Enterprise 2-Way Sync',
    state: 'connected',
    latencyMs: 84,
    uptimePercent: 99.92,
    details: 'Dual-Object Vector Sync Pipeline',
    extraMeta: {
      syncedRecords: 1492,
      autoMappedProps: 48,
    },
  },
];
