import type { SpeechRecognitionResult, VADEvent } from './types';

export interface ISpeechInputProvider {
  readonly providerName: string;
  startListening(callbacks: {
    onTranscript: (result: SpeechRecognitionResult) => void;
    onVAD?: (event: VADEvent) => void;
    onError?: (error: Error) => void;
  }): Promise<void>;
  stopListening(): void;
  isListening(): boolean;
}

/**
 * Browser-based Speech Input using Web Speech Recognition API with fallback
 */
export class BrowserSpeechInputProvider implements ISpeechInputProvider {
  readonly providerName = 'browser_speech_recognition';
  private recognition: any = null;
  private active = false;

  async startListening(callbacks: {
    onTranscript: (result: SpeechRecognitionResult) => void;
    onVAD?: (event: VADEvent) => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[SpeechInput] Web Speech API not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      let speechStartTime = Date.now();

      this.recognition.onstart = () => {
        this.active = true;
        callbacks.onVAD?.({
          type: 'speech_start',
          timestampMs: Date.now(),
        });
      };

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcriptText = res[0]?.transcript || '';
          const confidence = res[0]?.confidence || 0.95;
          const isFinal = res.isFinal;

          callbacks.onTranscript({
            text: transcriptText.trim(),
            isFinal,
            confidence,
            startMs: speechStartTime,
            endMs: Date.now(),
            speaker: 'prospect',
          });

          if (isFinal) {
            speechStartTime = Date.now();
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          callbacks.onError?.(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      this.recognition.onend = () => {
        this.active = false;
        callbacks.onVAD?.({
          type: 'speech_stop',
          timestampMs: Date.now(),
        });
      };

      this.recognition.start();
    } catch (err: unknown) {
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  stopListening(): void {
    if (this.recognition && this.active) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
    }
    this.active = false;
  }

  isListening(): boolean {
    return this.active;
  }
}
