import type {
  VoicePreset,
  VoiceSynthesisOptions,
  SynthesisResult,
  StreamSynthesisChunk,
  VoiceEngineHealth,
} from './types';

export interface IVoiceProvider {
  readonly providerName: string;

  /**
   * Returns list of available voice presets with metadata
   */
  listVoices(): Promise<VoicePreset[]>;

  /**
   * Retrieves specific voice preset details
   */
  getVoice(voiceId: string): Promise<VoicePreset | null>;

  /**
   * Synthesizes full text to audio buffer
   */
  synthesize(options: VoiceSynthesisOptions): Promise<SynthesisResult>;

  /**
   * Streams audio chunks in real time as they become available from provider
   */
  streamSynthesize(
    options: VoiceSynthesisOptions,
    onChunk: (chunk: StreamSynthesisChunk) => void
  ): Promise<SynthesisResult>;

  /**
   * Aborts active synthesis request
   */
  cancelSynthesis(utteranceId: string): void;

  /**
   * Verifies provider connectivity and health status
   */
  getHealth(): Promise<VoiceEngineHealth>;
}
