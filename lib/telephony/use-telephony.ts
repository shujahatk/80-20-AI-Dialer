'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { browserDeviceManager } from '@/services/telephony/device-manager';
import { getCallStateDisplayLabel } from '@/services/telephony/call-events';
import type { CallState } from '@/services/telephony/types';
import type { LeadRow } from '@/repositories/leads.repository';

export interface ActiveCallContext {
  callId: string;
  lead: LeadRow;
  campaignId?: string | null;
  destinationNumber: string;
}

export function useTelephony() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCallContext | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [remoteVolume, setRemoteVolume] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Twilio Device with token
  const initDevice = useCallback(async () => {
    try {
      const res = await fetch('/api/telephony/token');
      const json = await res.json();
      if (!json.success || !json.data) {
        setIsDeviceReady(false);
        return false;
      }
      if (json.data.registerDevice === false) {
        setIsDeviceReady(false);
        return false;
      }
      if (json.data.token) {
        const ok = await browserDeviceManager.initialize(json.data.token);
        setIsDeviceReady(ok);
        return ok;
      }
    } catch {
      setIsDeviceReady(false);
    }
    return false;
  }, []);

  useEffect(() => {
    browserDeviceManager.setCallbacks({
      onStateChange: (state: CallState) => {
        setCallState(state);
        if (state === 'idle' || state === 'completed' || state === 'failed' || state === 'busy' || state === 'no_answer' || state === 'cancelled') {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      onTimerStart: () => {
        setDurationSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setDurationSeconds((prev) => prev + 1);
        }, 1000);
      },
      onTimerStop: (totalSec: number) => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setDurationSeconds(totalSec);
      },
      onError: (err: string) => {
        if (/AccessTokenInvalid|unable to validate your Access Token/i.test(err)) {
          return;
        }
        setErrorMessage(err);
      },
      onVolumeChange: (input: number, output: number) => {
        setMicVolume(Math.min(100, Math.floor(input * 100)));
        setRemoteVolume(Math.min(100, Math.floor(output * 100)));
      },
    });

    initDevice();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      browserDeviceManager.destroy();
    };
  }, [initDevice]);

  /**
   * Start a call to a lead
   */
  const startCall = async (leadId: string, campaignId?: string | null) => {
    setErrorMessage(null);
    setCallState('preparing');

    try {
      // 1. Initiate call record on server
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, campaignId, recordCall: true }),
      });

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error?.message || 'Failed to initialize call');
      }

      const { call, lead, destinationNumber } = json.data;
      setActiveCall({
        callId: call.id,
        lead,
        campaignId,
        destinationNumber,
      });

      // 2. Connect browser WebRTC device
      await browserDeviceManager.makeCall({
        destinationNumber,
        leadId: lead.id,
        callId: call.id,
        campaignId,
        recordCall: true,
      });
    } catch (err: unknown) {
      setCallState('failed');
      const msg = err instanceof Error ? err.message : 'Call connection failed';
      setErrorMessage(msg);
      throw err;
    }
  };

  /**
   * Hang up the active call
   */
  const endCall = () => {
    browserDeviceManager.hangup();
    setIsMuted(false);
  };

  /**
   * Toggle mute
   */
  const toggleMute = () => {
    const nextMuted = !isMuted;
    browserDeviceManager.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  /**
   * Send DTMF tone
   */
  const sendDtmf = (digit: string) => {
    browserDeviceManager.sendDtmf(digit);
  };

  /**
   * Emergency session reset
   */
  const resetCallSession = () => {
    browserDeviceManager.resetSession();
    setActiveCall(null);
    setCallState('idle');
    setDurationSeconds(0);
    setIsMuted(false);
    setErrorMessage(null);
  };

  /**
   * Assign disposition to finished call
   */
  const submitDisposition = async (dispositionCode: string, notes?: string) => {
    if (!activeCall) return;
    try {
      await fetch(`/api/calls/${activeCall.callId}/disposition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: activeCall.lead.id,
          dispositionCode,
          notes,
        }),
      });
    } catch (err) {
      console.error('[useTelephony] Failed to submit disposition:', err);
    }
  };

  return {
    callState,
    statusLabel: getCallStateDisplayLabel(callState),
    activeCall,
    isMuted,
    durationSeconds,
    micVolume,
    remoteVolume,
    errorMessage,
    isDeviceReady,
    startCall,
    endCall,
    toggleMute,
    sendDtmf,
    resetCallSession,
    submitDisposition,
  };
}
