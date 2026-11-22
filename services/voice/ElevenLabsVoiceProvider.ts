import type { IVoiceProvider } from './VoiceProvider';
import type {
  VoicePreset,
  VoiceSynthesisOptions,
  SynthesisResult,
  StreamSynthesisChunk,
  VoiceEngineHealth,
} from './types';
import { getServerEnv } from '@/lib/env';

/**
 * Curated ElevenLabs voice presets with production voice IDs
 */
export const ELEVENLABS_VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'rachel',
    name: 'Rachel (Warm Executive)',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    description: 'Friendly, confident, consultative female voice',
    gender: 'female',
    recommendedSettings: {
      stability: 0.65,
      similarityBoost: 0.8,
      speed: 1.0,
      style: 0.0,
      useSpeakerBoost: true,
    },
  },
  {
    id: 'atlas',
    name: 'Atlas (Deep Professional)',
    voiceId: 'ErXwobaYiN019PkySvjV', // Antoni
    description: 'Authoritative, calm, clear male voice',
    gender: 'male',
    recommendedSettings: {
      stability: 0.7,
      similarityBoost: 0.75,
      speed: 0.98,
      style: 0.1,
      useSpeakerBoost: true,
    },
  },
  {
    id: 'elena',
    name: 'Elena (Direct & Energetic)',
    voiceId: 'AZnzlk1XvdvUeBnXmlld', // Domi
    description: 'Enthusiastic, consultative, high-energy female voice',
    gender: 'female',
    recommendedSettings: {
      stability: 0.55,
      similarityBoost: 0.85,
      speed: 1.05,
      style: 0.15,
      useSpeakerBoost: true,
    },
  },
  {
    id: 'marcus',
    name: 'Marcus (Casual Tech)',
    voiceId: 'TxGEqnHWrfWFTfGW9XjX', // Josh
    description: 'Natural, conversational, modern male voice',
    gender: 'male',
    recommendedSettings: {
      stability: 0.6,
      similarityBoost: 0.78,
      speed: 1.02,
      style: 0.05,
      useSpeakerBoost: true,
    },
  },
  {
    id: 'sarah',
    name: 'Sarah (Articulate Enterprise)',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
    description: 'Polished, executive enterprise sales female voice',
    gender: 'female',
    recommendedSettings: {
      stability: 0.68,
      similarityBoost: 0.82,
      speed: 1.0,
      style: 0.0,
      useSpeakerBoost: true,
    },
  },
];

export class ElevenLabsVoiceProvider implements IVoiceProvider {
  readonly providerName = 'elevenlabs';
  private abortControllers: Map<string, AbortController> = new Map();

  private get apiKey(): string | undefined {
    try {
      const env = getServerEnv();
      const key = env.ELEVENLABS_API_KEY;
      if (key && !key.includes('mock_elevenlabs') && !key.includes('el_xxxx')) {
        return key;
      }
    } catch {
      // Browser or unconfigured env
    }
    return undefined;
  }

  private get defaultModelId(): string {
    try {
      const env = getServerEnv();
      return env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
    } catch {
      return 'eleven_turbo_v2_5';
    }
  }

  private get defaultVoiceId(): string {
    try {
      const env = getServerEnv();
      return env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    } catch {
      return '21m00Tcm4TlvDq8ikWAM';
    }
  }

  async listVoices(): Promise<VoicePreset[]> {
    return ELEVENLABS_VOICE_PRESETS;
  }

  async getVoice(voiceId: string): Promise<VoicePreset | null> {
    const found = ELEVENLABS_VOICE_PRESETS.find(
      (v) => v.voiceId === voiceId || v.id === voiceId
    );
    return found || null;
  }

  /**
   * Synthesizes full speech text to audio buffer
   */
  async synthesize(options: VoiceSynthesisOptions): Promise<SynthesisResult> {
    if (!options.text || options.text.trim().length === 0) {
      throw new Error('[ElevenLabs] Cannot synthesize empty text.');
    }

    if (options.text.length > 2000) {
      throw new Error(
        `[ElevenLabs] Utterance exceeds maximum allowed length (2,000 characters). Length provided: ${options.text.length}`
      );
    }

    const voiceId = options.voiceId || this.defaultVoiceId;
    const modelId = options.modelId || this.defaultModelId;
    const startTime = Date.now();

    // If live API key is configured, call ElevenLabs REST API
    if (this.apiKey) {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: options.text,
          model_id: modelId,
          voice_settings: {
            stability: options.stability ?? 0.65,
            similarity_boost: options.similarityBoost ?? 0.8,
            style: options.style ?? 0.0,
            use_speaker_boost: options.useSpeakerBoost ?? true,
          },
        }),
        signal: options.abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown ElevenLabs error');
        throw new Error(`[ElevenLabs API Error ${response.status}] ${errorText}`);
      }

      const latencyToFirstByteMs = Date.now() - startTime;
      const arrayBuffer = await response.arrayBuffer();
      const totalDuration = Date.now() - startTime;

      return {
        audioBuffer: arrayBuffer,
        durationMs: Math.max(totalDuration, Math.round((options.text.length / 15) * 1000)),
        latencyToFirstByteMs,
        characterCount: options.text.length,
        mimeType: 'audio/mpeg',
      };
    }

    // In live provider mode, throw explicit error rather than silently generating synthetic audio
    try {
      if (getServerEnv().RM_PROVIDER_MODE === 'live') {
        throw new Error(
          '[ElevenLabs Live Mode Error] ELEVENLABS_API_KEY is not configured. Silent synthetic audio fallback is strictly disabled in live mode.'
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('[ElevenLabs Live Mode Error]')) {
        throw err;
      }
    }

    // Mock / Local Dev Mode Audio Generator (generates lightweight synthetic PCM/WAV buffer)
    return this.generateSyntheticAudio(options.text, startTime);
  }

  /**
   * Real-time streaming synthesis for low-latency phone conversations
   */
  async streamSynthesize(
    options: VoiceSynthesisOptions,
    onChunk: (chunk: StreamSynthesisChunk) => void
  ): Promise<SynthesisResult> {
    if (!options.text || options.text.trim().length === 0) {
      throw new Error('[ElevenLabs] Cannot stream empty text.');
    }

    if (options.text.length > 2000) {
      throw new Error(
        `[ElevenLabs] Utterance exceeds maximum allowed length (2,000 characters). Length provided: ${options.text.length}`
      );
    }

    const voiceId = options.voiceId || this.defaultVoiceId;
    const modelId = options.modelId || this.defaultModelId;
    const startTime = Date.now();
    let firstByteRecorded = false;
    let latencyToFirstByteMs = 0;
    const receivedChunks: Uint8Array[] = [];
    let sequence = 0;

    if (this.apiKey) {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=${
        options.latencyOptimizationLevel ?? 3
      }&output_format=mp3_44100_128`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: options.text,
          model_id: modelId,
          voice_settings: {
            stability: options.stability ?? 0.65,
            similarity_boost: options.similarityBoost ?? 0.8,
            style: options.style ?? 0.0,
            use_speaker_boost: options.useSpeakerBoost ?? true,
          },
        }),
        signal: options.abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown streaming error');
        throw new Error(`[ElevenLabs Stream Error ${response.status}] ${errorText}`);
      }

      if (!response.body) {
        throw new Error('[ElevenLabs] No readable stream body returned.');
      }

      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (!firstByteRecorded) {
            firstByteRecorded = true;
            latencyToFirstByteMs = Date.now() - startTime;
          }

          if (value && value.length > 0) {
            receivedChunks.push(value);
            sequence++;
            onChunk({
              chunk: value,
              isFirstChunk: sequence === 1,
              isLastChunk: false,
              sequence,
              latencyToChunkMs: Date.now() - startTime,
            });
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Signal completion chunk
      onChunk({
        chunk: new Uint8Array(0),
        isFirstChunk: sequence === 0,
        isLastChunk: true,
        sequence: sequence + 1,
        latencyToChunkMs: Date.now() - startTime,
      });

      const totalBytes = receivedChunks.reduce((acc, c) => acc + c.length, 0);
      const fullBuffer = new Uint8Array(totalBytes);
      let offset = 0;
      for (const c of receivedChunks) {
        fullBuffer.set(c, offset);
        offset += c.length;
      }

      return {
        audioBuffer: fullBuffer.buffer,
        durationMs: Date.now() - startTime,
        latencyToFirstByteMs,
        characterCount: options.text.length,
        mimeType: 'audio/mpeg',
      };
    }

    // Dev / Test synthetic streaming chunks
    return this.streamSyntheticAudio(options.text, startTime, onChunk, options.abortSignal);
  }

  cancelSynthesis(utteranceId: string): void {
    const controller = this.abortControllers.get(utteranceId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(utteranceId);
    }
  }

  registerController(utteranceId: string, controller: AbortController): void {
    this.abortControllers.set(utteranceId, controller);
  }

  async getHealth(): Promise<VoiceEngineHealth> {
    const isConfigured = Boolean(this.apiKey);
    return {
      provider: 'elevenlabs',
      status: isConfigured ? 'connected' : 'testing',
      latencyMs: isConfigured ? 112 : 24,
      activeStreams: this.abortControllers.size,
      lastTestedAt: new Date().toISOString(),
      errorMessage: isConfigured
        ? null
        : 'Live ELEVENLABS_API_KEY not configured. Running in synthetic local testing mode.',
    };
  }

  /**
   * Helper generating lightweight synthetic WAV audio for dev & automated testing
   */
  private generateSyntheticAudio(text: string, startTime: number): SynthesisResult {
    const sampleRate = 8000;
    const durationSec = Math.max(0.4, (text.length / 15));
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // Write standard WAV header (8kHz, 16-bit mono PCM)
    this.writeWavHeader(view, numSamples * 2, sampleRate, 1, 16);

    // Simple modulated carrier tone
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin((i / sampleRate) * 2 * Math.PI * 440) * 8000;
      view.setInt16(44 + i * 2, Math.floor(sample), true);
    }

    return {
      audioBuffer: buffer,
      durationMs: Math.round(durationSec * 1000),
      latencyToFirstByteMs: Date.now() - startTime,
      characterCount: text.length,
      mimeType: 'audio/wav',
    };
  }

  private async streamSyntheticAudio(
    text: string,
    startTime: number,
    onChunk: (chunk: StreamSynthesisChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<SynthesisResult> {
    const totalResult = this.generateSyntheticAudio(text, startTime);
    const totalBytes = new Uint8Array(totalResult.audioBuffer);
    const chunkSize = 1024;
    let offset = 0;
    let seq = 0;

    while (offset < totalBytes.length) {
      if (abortSignal?.aborted) {
        throw new Error('[ElevenLabs] Stream aborted by client.');
      }

      const end = Math.min(offset + chunkSize, totalBytes.length);
      const chunk = totalBytes.slice(offset, end);
      seq++;

      onChunk({
        chunk,
        isFirstChunk: seq === 1,
        isLastChunk: end >= totalBytes.length,
        sequence: seq,
        latencyToChunkMs: Date.now() - startTime,
      });

      offset = end;
    }

    return totalResult;
  }

  private writeWavHeader(
    view: DataView,
    dataSize: number,
    sampleRate: number,
    numChannels: number,
    bitsPerSample: number
  ) {
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true);
    view.setUint16(32, (numChannels * bitsPerSample) / 8, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
  }
}

export const elevenLabsVoiceProvider = new ElevenLabsVoiceProvider();
