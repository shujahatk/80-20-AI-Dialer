'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { authenticatedFetch } from '@/lib/api/client';
import { browserDeviceManager } from '@/services/telephony/device-manager';
import { getCallStateDisplayLabel } from '@/services/telephony/call-events';
import type { CallState } from '@/services/telephony/types';
import type { LeadRow } from '@/repositories/leads.repository';

export interface ActiveCallContext {
  callId: string;
  retellCallId?: string | null;
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
  const [conflictCallId, setConflictCallId] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
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
   * Start an outbound Retell AI phone call to a lead via PSTN carrier infrastructure
   */
  const startCall = async (leadId: string, campaignId?: string | null, phoneNumber?: string | null) => {
    setErrorMessage(null);
    setCallState('preparing');

    try {
      // 1. Initiate outbound call through authenticated server API
      const res = await authenticatedFetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, campaignId, phoneNumber, recordCall: true }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        const corrInfo = json.error?.correlationId ? ` [Correlation: ${json.error.correlationId}]` : '';
        const errMsg = (json.error?.message || (typeof json.error === 'string' ? json.error : null) || 'Failed to initiate outbound call') + corrInfo;

        if (json.error?.activeCallId) {
          setConflictCallId(json.error.activeCallId);
        } else {
          const match = errMsg.match(/Call ID:\s*([0-9a-f-]{36})/i);
          if (match) setConflictCallId(match[1]);
        }

        throw new Error(errMsg);
      }

      const { call, lead, destinationNumber, retellCallId, provider } = json.data;
      setActiveCall({
        callId: call.id,
        retellCallId: retellCallId || call.retell_call_id,
        lead,
        campaignId,
        destinationNumber,
      });

      // Retell carrier PSTN call successfully registered and dispatched to provider
      setCallState('dialing');
      setDurationSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      setCallState('failed');
      const msg = err instanceof Error ? err.message : 'Outbound call initiation failed';
      setErrorMessage(msg);
      throw err;
    }
  };

  /**
   * Hang up the active call
   */
  const endCall = () => {
    browserDeviceManager.hangup();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallState('completed');
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
    setConflictCallId(null);
    setIsReconciling(false);
  };

  /**
   * Reconciles a stuck or active call directly with Retell AI provider
   */
  const reconcileStuckCall = async (targetCallId?: string) => {
    const idToReconcile = targetCallId || conflictCallId;
    if (!idToReconcile) return { success: false, error: 'No call ID to reconcile' };

    setIsReconciling(true);
    setErrorMessage('Reconciling call state with Retell AI provider...');

    try {
      const res = await authenticatedFetch(`/api/calls/${idToReconcile}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconcile' }),
      });
      const data = await res.json();
      if (data.success) {
        setConflictCallId(null);
        setCallState('idle');
        setErrorMessage(null);
        return { success: true, message: data.data?.message || 'Call successfully reconciled' };
      } else {
        const err = data.error?.message || 'Failed to reconcile call with Retell';
        setErrorMessage(err);
        return { success: false, error: err };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reconciliation failed';
      setErrorMessage(msg);
      return { success: false, error: msg };
    } finally {
      setIsReconciling(false);
    }
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
    conflictCallId,
    isReconciling,
    isDeviceReady,
    startCall,
    endCall,
    toggleMute,
    sendDtmf,
    resetCallSession,
    reconcileStuckCall,
    submitDisposition,
  };
}
