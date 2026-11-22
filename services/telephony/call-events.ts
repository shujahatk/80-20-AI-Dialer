import type { CallState, CallEventType } from './types';

/**
 * Normalizes raw Twilio call statuses to RM AI Dialer internal CallState
 */
export function normalizeTwilioCallStatus(twilioStatus: string): CallState {
  const normalized = twilioStatus.toLowerCase().trim();
  switch (normalized) {
    case 'queued':
    case 'initiated':
      return 'dialing';
    case 'ringing':
      return 'ringing';
    case 'in-progress':
    case 'answered':
      return 'connected';
    case 'completed':
      return 'completed';
    case 'busy':
      return 'busy';
    case 'no-answer':
      return 'no_answer';
    case 'canceled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'dialing';
  }
}

/**
 * Maps Twilio status to normalized CallEventType
 */
export function twilioStatusToEventType(twilioStatus: string): CallEventType {
  const normalized = twilioStatus.toLowerCase().trim();
  switch (normalized) {
    case 'queued':
    case 'initiated':
      return 'dialing';
    case 'ringing':
      return 'ringing';
    case 'in-progress':
    case 'answered':
      return 'connected';
    case 'completed':
      return 'completed';
    case 'busy':
      return 'busy';
    case 'no-answer':
      return 'no_answer';
    case 'canceled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'dialing';
  }
}

/**
 * Formats user-facing business status label from CallState
 */
export function getCallStateDisplayLabel(state: CallState): string {
  switch (state) {
    case 'idle':
      return 'Ready';
    case 'preparing':
      return 'Preparing Call...';
    case 'dialing':
      return 'Calling...';
    case 'ringing':
      return 'Ringing...';
    case 'connected':
      return 'Connected';
    case 'ending':
      return 'Ending Call...';
    case 'completed':
      return 'Call Completed';
    case 'busy':
      return 'Line Busy';
    case 'no_answer':
      return 'No Answer';
    case 'failed':
      return 'Call Failed';
    case 'cancelled':
      return 'Call Cancelled';
  }
}
