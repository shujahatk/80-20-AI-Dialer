import type { TranscriptSegment, SpeakerRole } from './types';
import type { Database, Json } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CallsRepository } from '@/repositories/calls.repository';

export class TranscriptManager {
  private callId: string;
  private organizationId: string;
  private sequenceCounter = 0;
  private segments: TranscriptSegment[] = [];
  private listeners: ((segment: TranscriptSegment) => void)[] = [];
  private repo?: CallsRepository;

  constructor(
    callId: string,
    organizationId: string,
    supabaseClient?: SupabaseClient<Database>
  ) {
    this.callId = callId;
    this.organizationId = organizationId;
    if (supabaseClient) {
      this.repo = new CallsRepository(supabaseClient);
    }
  }

  /**
   * Adds a new transcript segment and returns the persisted structure
   */
  async addSegment(params: {
    speaker: SpeakerRole;
    text: string;
    startedAtMs?: number;
    endedAtMs?: number;
    confidence?: number;
    isFinal?: boolean;
    speakerName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TranscriptSegment> {
    this.sequenceCounter++;
    const now = Date.now();
    const startedAtMs = params.startedAtMs ?? now;
    const endedAtMs = params.endedAtMs ?? now + Math.max(500, params.text.length * 50);

    const segment: TranscriptSegment = {
      id: `tr_${Date.now()}_${this.sequenceCounter}`,
      callId: this.callId,
      speaker: params.speaker,
      speakerName:
        params.speakerName ||
        (params.speaker === 'agent'
          ? 'Rachel (AI)'
          : params.speaker === 'prospect'
          ? 'Prospect'
          : 'Operator'),
      sequenceNumber: this.sequenceCounter,
      text: params.text.trim(),
      startedAtMs,
      endedAtMs,
      confidence: params.confidence ?? 0.98,
      isFinal: params.isFinal ?? true,
      metadata: params.metadata,
    };

    this.segments.push(segment);

    // Notify in-memory listeners immediately for UI responsiveness
    for (const listener of this.listeners) {
      try {
        listener(segment);
      } catch (err) {
        console.error('[TranscriptManager] Error in segment listener callback', err);
      }
    }

    // Asynchronously persist final segments to repository without blocking audio
    if (segment.isFinal && this.repo) {
      this.persistSegment(segment).catch((err) => {
        console.warn('[TranscriptManager] Failed to persist transcript segment', err);
      });
    }

    return segment;
  }

  /**
   * Persists segment to Supabase call_transcripts table
   */
  private async persistSegment(segment: TranscriptSegment): Promise<void> {
    if (!this.repo) return;

    const dbSpeaker =
      segment.speaker === 'agent'
        ? 'ai'
        : segment.speaker === 'prospect'
        ? 'lead'
        : segment.speaker === 'operator'
        ? 'operator'
        : 'system';

    await this.repo.saveTranscriptSegment({
      call_id: segment.callId,
      speaker: dbSpeaker,
      sequence_number: segment.sequenceNumber,
      text: segment.text,
      started_at_ms: segment.startedAtMs,
      ended_at_ms: segment.endedAtMs,
      confidence: segment.confidence,
      metadata: (segment.metadata || {}) as Json,
    });
  }

  getSegments(): TranscriptSegment[] {
    return [...this.segments];
  }

  subscribe(listener: (segment: TranscriptSegment) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  clear(): void {
    this.segments = [];
    this.sequenceCounter = 0;
  }
}
