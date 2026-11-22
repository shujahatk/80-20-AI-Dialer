import type { ConversationState } from './types';
export type { ConversationState };

/**
 * Valid conversation sub-state transitions.
 * Kept strictly isolated from Twilio call transport states.
 */
export const VALID_CONVERSATION_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  idle: ['listening'],
  listening: ['prospect_speaking', 'processing', 'ai_speaking', 'idle'],
  prospect_speaking: ['processing', 'listening', 'idle'],
  processing: ['ai_speaking', 'listening', 'idle'],
  ai_speaking: ['interrupted', 'listening', 'idle'],
  interrupted: ['prospect_speaking', 'listening', 'processing', 'idle'],
};

/**
 * Checks if a transition between conversation sub-states is valid
 */
export function isValidConversationTransition(
  current: ConversationState,
  target: ConversationState
): boolean {
  if (current === target) return true;
  const allowed = VALID_CONVERSATION_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

/**
 * Asserts valid conversation state transition
 */
export function assertValidConversationTransition(
  current: ConversationState,
  target: ConversationState
): void {
  if (!isValidConversationTransition(current, target)) {
    throw new Error(
      `[RM Conversation State Error] Illegal state transition from "${current}" to "${target}". Allowed targets: ${JSON.stringify(
        VALID_CONVERSATION_TRANSITIONS[current] || []
      )}`
    );
  }
}

/**
 * Display label helper for clean workstation UI
 */
export function getConversationStateLabel(state: ConversationState): string {
  switch (state) {
    case 'idle':
      return 'AI Inactive';
    case 'listening':
      return 'AI Listening';
    case 'prospect_speaking':
      return 'Prospect Speaking';
    case 'processing':
      return 'Thinking...';
    case 'ai_speaking':
      return 'AI Speaking';
    case 'interrupted':
      return 'Interrupted (Barge-In)';
    default:
      return 'Unknown';
  }
}

/**
 * Stateful Conversation Sub-State Manager
 */
export class ConversationStateMachine {
  private currentState: ConversationState = 'idle';
  private listeners: ((state: ConversationState, previous: ConversationState) => void)[] = [];

  constructor(initialState: ConversationState = 'idle') {
    this.currentState = initialState;
  }

  getState(): ConversationState {
    return this.currentState;
  }

  transition(target: ConversationState): boolean {
    if (this.currentState === target) return true;

    if (!isValidConversationTransition(this.currentState, target)) {
      console.warn(
        `[ConversationStateMachine] Blocked invalid transition: ${this.currentState} -> ${target}`
      );
      return false;
    }

    const prev = this.currentState;
    this.currentState = target;

    for (const listener of this.listeners) {
      try {
        listener(this.currentState, prev);
      } catch (err) {
        console.error('[ConversationStateMachine] Error in listener callback', err);
      }
    }

    return true;
  }

  forceState(state: ConversationState): void {
    const prev = this.currentState;
    this.currentState = state;
    for (const listener of this.listeners) {
      try {
        listener(this.currentState, prev);
      } catch (err) {
        console.error('[ConversationStateMachine] Error in listener callback', err);
      }
    }
  }

  subscribe(listener: (state: ConversationState, previous: ConversationState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  reset(): void {
    this.transition('idle');
  }
}
