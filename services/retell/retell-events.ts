/**
 * RM AI DIALER — RETELL EVENT NORMALIZATION
 * Maps Retell API runtime events and call states to normalized RM event types.
 */

import type { RetellCallStatus, RetellDisconnectionReason } from './types';

export type NormalizedRMCallEventType =
  | 'call_created'
  | 'call_dialing'
  | 'call_ringing'
  | 'call_connected'
  | 'call_in_progress'
  | 'transcript_updated'
  | 'call_transfer_requested'
  | 'call_transfer_completed'
  | 'call_completed'
  | 'call_busy'
  | 'call_no_answer'
  | 'call_failed'
  | 'call_voicemail'
  | 'call_analysis_ready';

/**
 * Maps a Retell call status to normalized RM call status string.
 */
export function normalizeRetellCallStatus(
  retellStatus: RetellCallStatus,
  disconnectionReason?: RetellDisconnectionReason
): 'queued' | 'ringing' | 'in_progress' | 'completed' | 'busy' | 'no_answer' | 'failed' | 'cancelled' {
  switch (retellStatus) {
    case 'registered':
      return 'queued';
    case 'ongoing':
      return 'in_progress';
    case 'not_connected':
      if (disconnectionReason) return mapDisconnectionToCallStatus(disconnectionReason);
      return 'failed';
    case 'ended':
      if (!disconnectionReason) return 'completed';
      return mapDisconnectionToCallStatus(disconnectionReason);
    case 'error':
      return 'failed';
    default:
      if (disconnectionReason) return mapDisconnectionToCallStatus(disconnectionReason);
      return 'queued';
  }
}

/**
 * Maps Retell disconnection reason to RM call status
 */
export function mapDisconnectionToCallStatus(
  reason: RetellDisconnectionReason
): 'completed' | 'busy' | 'no_answer' | 'failed' | 'cancelled' {
  const norm = reason.toLowerCase();

  if (
    norm === 'user_hangup' ||
    norm === 'agent_hangup' ||
    norm === 'call_transfer' ||
    norm === 'inactivity'
  ) {
    return 'completed';
  }

  if (norm === 'busy' || norm === 'dial_busy') {
    return 'busy';
  }

  if (
    norm === 'no_answer' ||
    norm === 'dial_no_answer' ||
    norm === 'voicemail_reached' ||
    norm === 'machine_detected'
  ) {
    return 'no_answer';
  }

  if (norm === 'failed' || norm === 'dial_failed' || norm === 'error') {
    return 'failed';
  }

  if (norm === 'concurrency_limit_reached') {
    return 'failed';
  }

  return 'completed';
}

/**
 * Maps a Retell webhook event to an internal normalized RM call event type
 */
export function retellEventToNormalizedType(
  retellEvent: string,
  disconnectionReason?: RetellDisconnectionReason
): NormalizedRMCallEventType {
  switch (retellEvent) {
    case 'call_started':
      return 'call_connected';
    case 'transcript_updated':
      return 'transcript_updated';
    case 'call_ended': {
      if (!disconnectionReason) return 'call_completed';
      const status = mapDisconnectionToCallStatus(disconnectionReason);
      if (status === 'busy') return 'call_busy';
      if (status === 'no_answer') {
        return disconnectionReason.toLowerCase().includes('voicemail')
          ? 'call_voicemail'
          : 'call_no_answer';
      }
      if (status === 'failed') return 'call_failed';
      return 'call_completed';
    }
    case 'call_analyzed':
      return 'call_analysis_ready';
    default:
      return 'call_in_progress';
  }
}
