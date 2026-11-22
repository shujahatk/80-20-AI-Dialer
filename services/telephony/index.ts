import type { CallStatus, TelephonyGuardrails, ProviderStatus } from '@/types';

/**
 * Conceptual Telephony Gateway Contract
 * (Reserved for future Twilio WebRTC / SIP Trunking integration)
 */
export interface TelephonySessionOptions {
  callerId?: string;
  destinationNumber: string;
  enableRecording?: boolean;
  detectAnsweringMachine?: boolean;
  timeoutSeconds?: number;
}

export interface ITelephonyService {
  initializeGateway(token?: string): Promise<{ success: boolean; latencyMs: number }>;
  dialLead(leadId: string, options: TelephonySessionOptions): Promise<{ callSid: string }>;
  endCall(callSid: string): Promise<boolean>;
  muteMicrophone(muted: boolean): void;
  sendDtmfDigit(digit: string): void;
  transferCall(destination: string): Promise<boolean>;
  getTrunkHealth(): Promise<ProviderStatus>;
  updateGuardrails(settings: Partial<TelephonyGuardrails>): Promise<boolean>;
}

export class TelephonyServicePlaceholder implements ITelephonyService {
  async initializeGateway(): Promise<{ success: boolean; latencyMs: number }> {
    // Phase 2 will implement WebSockets / Twilio Voice SDK
    return { success: true, latencyMs: 18 };
  }

  async dialLead(leadId: string, options: TelephonySessionOptions): Promise<{ callSid: string }> {
    return { callSid: `CA_${Date.now()}` };
  }

  async endCall(callSid: string): Promise<boolean> {
    return true;
  }

  muteMicrophone(muted: boolean): void {}

  sendDtmfDigit(digit: string): void {}

  async transferCall(destination: string): Promise<boolean> {
    return true;
  }

  async getTrunkHealth(): Promise<ProviderStatus> {
    return {
      id: 'twilio',
      name: 'Twilio SIP Trunking',
      tier: 'Tier-1 Enterprise',
      state: 'connected',
      latencyMs: 18,
      uptimePercent: 99.98,
      activeChannels: 28,
      maxChannels: 50,
      details: 'US-East-1 Cluster operational',
    };
  }

  async updateGuardrails(settings: Partial<TelephonyGuardrails>): Promise<boolean> {
    return true;
  }
}

export const telephonyService = new TelephonyServicePlaceholder();
