'use client';

import { Device, Call } from '@twilio/voice-sdk';
import type { CallState } from './types';

export interface DeviceManagerCallbacks {
  onStateChange: (state: CallState) => void;
  onTimerStart: () => void;
  onTimerStop: (totalSeconds: number) => void;
  onError: (errorMessage: string) => void;
  onVolumeChange?: (inputLevel: number, outputLevel: number) => void;
}

function isInvalidAccessToken(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { code?: number; name?: string; message?: string };
  return (
    candidate.code === 20101 ||
    candidate.name === 'AccessTokenInvalid' ||
    /AccessTokenInvalid|unable to validate your Access Token/i.test(candidate.message || '')
  );
}

export class BrowserDeviceManager {
  private device: Device | null = null;
  private activeCall: Call | null = null;
  private token: string | null = null;
  private isInitialized: boolean = false;
  private callbacks: DeviceManagerCallbacks | null = null;
  private callStartTime: number | null = null;

  setCallbacks(callbacks: DeviceManagerCallbacks) {
    this.callbacks = callbacks;
  }

  async initialize(token: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Destroy existing instance before reinitializing
    if (this.device) {
      try {
        this.device.destroy();
      } catch {
        // ignore
      }
      this.device = null;
    }

    this.token = token;

    try {
      this.device = new Device(token, {
        logLevel: 'error',
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        closeProtection: true,
      });

      this.device.on('registered', () => {
        this.isInitialized = true;
      });

      this.device.on('error', (twilioError) => {
        if (isInvalidAccessToken(twilioError)) {
          this.isInitialized = false;
          return;
        }
        this.callbacks?.onError(twilioError.message || 'Telephony device connection error');
      });

      this.device.on('tokenWillExpire', async () => {
        try {
          const res = await fetch('/api/telephony/token');
          const json = await res.json();
          if (json.success && json.data?.registerDevice !== false && json.data?.token) {
            this.device?.updateToken(json.data.token);
          }
        } catch {
          // Token refresh failed; the next call attempt will re-initialize.
        }
      });

      await this.device.register();
      return true;
    } catch (err) {
      if (this.device) {
        try {
          this.device.destroy();
        } catch {
          // ignore
        }
        this.device = null;
      }
      this.isInitialized = false;
      if (!isInvalidAccessToken(err)) {
        this.callbacks?.onError('Calling device could not start.');
      }
      return false;
    }
  }

  async makeCall(params: {
    destinationNumber: string;
    leadId?: string;
    callId?: string;
    campaignId?: string | null;
    recordCall?: boolean;
  }): Promise<Call | null> {
    if (!this.device) {
      throw new Error('Live carrier audio is not connected in this environment.');
    }

    this.callbacks?.onStateChange('dialing');

    try {
      const call = await this.device.connect({
        params: {
          To: params.destinationNumber,
          leadId: params.leadId || '',
          callId: params.callId || '',
          campaignId: params.campaignId || '',
          recordCall: params.recordCall !== false ? 'true' : 'false',
        },
      });

      this.activeCall = call;

      call.on('ringing', () => {
        this.callbacks?.onStateChange('ringing');
      });

      call.on('accept', () => {
        this.callStartTime = Date.now();
        this.callbacks?.onStateChange('connected');
        this.callbacks?.onTimerStart();
      });

      call.on('disconnect', () => {
        const durationSec = this.callStartTime ? Math.floor((Date.now() - this.callStartTime) / 1000) : 0;
        this.callbacks?.onTimerStop(durationSec);
        this.callbacks?.onStateChange('completed');
        this.activeCall = null;
        this.callStartTime = null;
      });

      call.on('cancel', () => {
        this.callbacks?.onStateChange('cancelled');
        this.activeCall = null;
        this.callStartTime = null;
      });

      call.on('reject', () => {
        this.callbacks?.onStateChange('busy');
        this.activeCall = null;
        this.callStartTime = null;
      });

      call.on('error', (error) => {
        console.error('[Twilio Call Error]', error);
        this.callbacks?.onStateChange('failed');
        this.callbacks?.onError(error.message || 'Call failed');
        this.activeCall = null;
        this.callStartTime = null;
      });

      call.on('volume', (inputVolume: number, outputVolume: number) => {
        this.callbacks?.onVolumeChange?.(inputVolume, outputVolume);
      });

      return call;
    } catch (err: unknown) {
      this.callbacks?.onStateChange('failed');
      const msg = err instanceof Error ? err.message : 'Failed to connect call';
      this.callbacks?.onError(msg);
      throw err;
    }
  }

  hangup() {
    if (this.activeCall) {
      this.callbacks?.onStateChange('ending');
      try {
        this.activeCall.disconnect();
      } catch {
        // ignore
      }
      this.activeCall = null;
    } else if (this.device) {
      this.device.disconnectAll();
      this.callbacks?.onStateChange('completed');
    }
  }

  setMuted(muted: boolean) {
    if (this.activeCall) {
      this.activeCall.mute(muted);
    }
  }

  isMuted(): boolean {
    return this.activeCall ? this.activeCall.isMuted() : false;
  }

  sendDtmf(digit: string) {
    if (this.activeCall) {
      this.activeCall.sendDigits(digit);
    }
  }

  resetSession() {
    if (this.activeCall) {
      try {
        this.activeCall.disconnect();
      } catch {
        // ignore
      }
      this.activeCall = null;
    }
    this.callStartTime = null;
    this.callbacks?.onStateChange('idle');
  }

  destroy() {
    this.resetSession();
    if (this.device) {
      try {
        this.device.destroy();
      } catch {
        // ignore
      }
      this.device = null;
    }
    this.isInitialized = false;
  }
}

export const browserDeviceManager = new BrowserDeviceManager();
