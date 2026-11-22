import type { IVoiceProvider } from './VoiceProvider';
import type { VoiceSynthesisOptions, StreamSynthesisChunk, SynthesisResult } from './types';
import { elevenLabsVoiceProvider } from './ElevenLabsVoiceProvider';
import { InterruptionManager } from './interruption-manager';
import type { ConversationStateMachine } from './conversation-state-machine';

export class SpeechOutputService {
  private provider: IVoiceProvider;
  private interruptionManager: InterruptionManager;

  constructor(
    provider: IVoiceProvider = elevenLabsVoiceProvider,
    interruptionManager?: InterruptionManager,
    stateMachine?: ConversationStateMachine
  ) {
    this.provider = provider;
    this.interruptionManager =
      interruptionManager || new InterruptionManager(stateMachine);
  }

  /**
   * Synthesizes and streams speech with abortable utterance management
   */
  async speak(
    text: string,
    options?: Partial<VoiceSynthesisOptions>,
    onAudioChunk?: (chunk: StreamSynthesisChunk) => void
  ): Promise<SynthesisResult> {
    const utteranceId = `utt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const abortController = this.interruptionManager.beginUtterance(utteranceId);

    try {
      const result = await this.provider.streamSynthesize(
        {
          text,
          ...options,
          abortSignal: abortController.signal,
        },
        (chunk) => {
          if (!abortController.signal.aborted) {
            onAudioChunk?.(chunk);
          }
        }
      );

      this.interruptionManager.finishUtterance(utteranceId);
      return result;
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        // Interrupted - return partial or canceled result
        return {
          audioBuffer: new ArrayBuffer(0),
          durationMs: 0,
          latencyToFirstByteMs: 0,
          characterCount: text.length,
          mimeType: 'audio/mpeg',
        };
      }
      this.interruptionManager.finishUtterance(utteranceId);
      throw err;
    }
  }

  interrupt(reason: 'prospect_speech' | 'operator_override' | 'call_ended' = 'prospect_speech'): boolean {
    return this.interruptionManager.interrupt(reason);
  }

  getInterruptionManager(): InterruptionManager {
    return this.interruptionManager;
  }
}
