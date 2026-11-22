/**
 * Phase 6 Voice & Real-Time Audio Layer Types
 */

export type VoiceModel =
  | 'eleven_turbo_v2_5'
  | 'eleven_flash_v2_5'
  | 'eleven_multilingual_v2'
  | 'eleven_monolingual_v1';

export interface VoicePreset {
  id: string;
  name: string;
  voiceId: string;
  description: string;
  gender: 'female' | 'male' | 'neutral';
  previewUrl?: string;
  recommendedSettings: {
    stability: number;
    similarityBoost: number;
    speed: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

export interface VoiceSynthesisOptions {
  text: string;
  voiceId?: string;
  modelId?: VoiceModel | string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  latencyOptimizationLevel?: number; // 0 to 4
  abortSignal?: AbortSignal;
}

export interface SynthesisResult {
  audioBuffer: ArrayBuffer;
  durationMs: number;
  latencyToFirstByteMs: number;
  characterCount: number;
  mimeType: string;
}

export interface StreamSynthesisChunk {
  chunk: Uint8Array;
  isFirstChunk: boolean;
  isLastChunk: boolean;
  sequence: number;
  latencyToChunkMs: number;
}

/**
 * Authoritative Conversation Sub-State
 * Kept strictly separate from Twilio Call Transport State (connected, ringing, etc.)
 */
export type ConversationState =
  | 'idle'
  | 'listening'
  | 'prospect_speaking'
  | 'processing'
  | 'ai_speaking'
  | 'interrupted';

export type SpeakerRole = 'agent' | 'prospect' | 'system' | 'operator';

export interface TranscriptSegment {
  id: string;
  callId: string;
  speaker: SpeakerRole;
  speakerName?: string;
  sequenceNumber: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  confidence: number;
  isFinal: boolean;
  metadata?: Record<string, unknown>;
}

export interface SpeechRecognitionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  startMs: number;
  endMs: number;
  speaker: SpeakerRole;
}

export interface VADEvent {
  type: 'speech_start' | 'speech_stop' | 'silence';
  timestampMs: number;
  durationMs?: number;
  energyLevel?: number;
}

export interface InterruptionEvent {
  utteranceId: string;
  timestampMs: number;
  offsetMs: number;
  reason: 'prospect_speech' | 'operator_override' | 'call_ended';
  partialSpeechCaptured?: string;
}

export interface AudioFramePayload {
  event: 'media' | 'start' | 'stop' | 'mark' | 'clear';
  streamSid: string;
  sequenceNumber?: number;
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string;
    timestamp: string;
    payload: string; // base64 encoded μ-law / PCM
  };
  mark?: {
    name: string;
  };
}

export interface VoiceEngineHealth {
  provider: 'elevenlabs';
  status: 'connected' | 'degraded' | 'disconnected' | 'testing';
  latencyMs: number;
  activeStreams: number;
  lastTestedAt: string | null;
  errorMessage: string | null;
}
