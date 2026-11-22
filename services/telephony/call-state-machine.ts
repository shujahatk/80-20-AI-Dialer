import type { CallState } from './types';

/**
 * Authoritative Call State Machine
 * Defines valid lifecycle transitions for RM AI Dialer calls.
 */
export const ALLOWED_CALL_TRANSITIONS: Record<CallState, CallState[]> = {
  idle: ['preparing', 'dialing'],
  preparing: ['dialing', 'failed', 'cancelled'],
  dialing: ['ringing', 'connected', 'busy', 'no_answer', 'failed', 'cancelled'],
  ringing: ['connected', 'no_answer', 'busy', 'failed', 'cancelled'],
  connected: ['ending', 'completed', 'failed'],
  ending: ['completed', 'failed'],
  completed: ['idle'], // Allow reset for next call
  busy: ['idle'],
  no_answer: ['idle'],
  failed: ['idle'],
  cancelled: ['idle'],
};

export const TERMINAL_CALL_STATES: ReadonlySet<CallState> = new Set([
  'completed',
  'busy',
  'no_answer',
  'failed',
  'cancelled',
]);

export function isValidCallTransition(from: CallState, to: CallState): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_CALL_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertValidCallTransition(from: CallState, to: CallState): void {
  if (!isValidCallTransition(from, to)) {
    throw new Error(`[CallStateMachine] Invalid call state transition from '${from}' to '${to}'`);
  }
}

export function isTerminalCallState(state: CallState): boolean {
  return TERMINAL_CALL_STATES.has(state);
}

/**
 * Maps terminal call states to campaign lead outcome codes.
 */
export function normalizeCallOutcome(state: CallState, finalDisposition?: string): string {
  if (finalDisposition) return finalDisposition;
  switch (state) {
    case 'completed':
      return 'completed';
    case 'busy':
      return 'busy';
    case 'no_answer':
      return 'no_answer';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'temporary_failure';
    default:
      return 'unknown';
  }
}
