import type { InterruptionEvent } from './types';
import type { ConversationStateMachine } from './conversation-state-machine';

export class InterruptionManager {
  private activeUtteranceId: string | null = null;
  private activeAbortController: AbortController | null = null;
  private utteranceStartTimeMs = 0;
  private isAiSpeaking = false;
  private onInterruptedCallbacks: ((event: InterruptionEvent) => void)[] = [];

  constructor(private stateMachine?: ConversationStateMachine) {}

  /**
   * Registers a new AI utterance about to start synthesis or playback
   */
  beginUtterance(utteranceId: string): AbortController {
    // If an earlier utterance was still running, abort it first
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }

    const controller = new AbortController();
    this.activeUtteranceId = utteranceId;
    this.activeAbortController = controller;
    this.utteranceStartTimeMs = Date.now();
    this.isAiSpeaking = true;

    if (this.stateMachine) {
      this.stateMachine.transition('ai_speaking');
    }

    return controller;
  }

  /**
   * Marks that the AI utterance finished playback normally without interruption
   */
  finishUtterance(utteranceId: string): void {
    if (this.activeUtteranceId === utteranceId) {
      this.activeUtteranceId = null;
      this.activeAbortController = null;
      this.isAiSpeaking = false;

      if (this.stateMachine && this.stateMachine.getState() === 'ai_speaking') {
        this.stateMachine.transition('listening');
      }
    }
  }

  /**
   * Triggers barge-in interruption immediately when prospect speaks or user overrides
   */
  interrupt(
    reason: 'prospect_speech' | 'operator_override' | 'call_ended' = 'prospect_speech',
    partialSpeech?: string
  ): boolean {
    if (!this.isAiSpeaking && !this.activeAbortController) {
      return false; // Nothing active to interrupt
    }

    const offsetMs = Date.now() - this.utteranceStartTimeMs;
    const interruptedUtteranceId = this.activeUtteranceId || 'unknown_utterance';

    // 1. Immediately abort active TTS synthesis/streaming
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    this.isAiSpeaking = false;
    this.activeUtteranceId = null;

    // 2. Transition conversation state machine to interrupted -> prospect_speaking
    if (this.stateMachine) {
      this.stateMachine.transition('interrupted');
      if (reason === 'prospect_speech') {
        this.stateMachine.transition('prospect_speaking');
      } else if (reason === 'call_ended') {
        this.stateMachine.transition('idle');
      }
    }

    const event: InterruptionEvent = {
      utteranceId: interruptedUtteranceId,
      timestampMs: Date.now(),
      offsetMs,
      reason,
      partialSpeechCaptured: partialSpeech,
    };

    // 3. Notify listeners
    for (const cb of this.onInterruptedCallbacks) {
      try {
        cb(event);
      } catch (err) {
        console.error('[InterruptionManager] Error in onInterrupted callback', err);
      }
    }

    return true;
  }

  isCurrentlySpeaking(): boolean {
    return this.isAiSpeaking;
  }

  getActiveUtteranceId(): string | null {
    return this.activeUtteranceId;
  }

  onInterrupted(cb: (event: InterruptionEvent) => void): () => void {
    this.onInterruptedCallbacks.push(cb);
    return () => {
      this.onInterruptedCallbacks = this.onInterruptedCallbacks.filter((c) => c !== cb);
    };
  }

  reset(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeUtteranceId = null;
    this.activeAbortController = null;
    this.isAiSpeaking = false;
  }
}
