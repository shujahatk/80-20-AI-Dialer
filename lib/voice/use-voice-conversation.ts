'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ConversationStateMachine,
  type ConversationState,
  getConversationStateLabel,
} from '@/services/voice/conversation-state-machine';
import { InterruptionManager } from '@/services/voice/interruption-manager';
import { TranscriptManager } from '@/services/voice/transcript-manager';
import { BrowserSpeechInputProvider } from '@/services/voice/speech-input';
import { generateDeterministicReply } from '@/services/voice/deterministic-replies';
import type { TranscriptSegment } from '@/services/voice/types';
import type { ConversationStage, QualificationModel } from '@/services/ai/types';
import { createInitialQualificationModel } from '@/services/ai/qualification-engine';

export interface UseVoiceConversationOptions {
  callId?: string;
  leadId?: string;
  leadName?: string;
  companyName?: string;
  phone?: string;
  jobTitle?: string;
  campaignId?: string;
  campaignName?: string;
  agentVoiceId?: string;
  agentName?: string;
  autoStart?: boolean;
}

export function useVoiceConversation(options: UseVoiceConversationOptions = {}) {
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [voiceHealth] = useState<string>('Ready');
  const [activeAudioLevel, setActiveAudioLevel] = useState(0);

  // Sales Intelligence State
  const [aiStage, setAiStage] = useState<ConversationStage>('opening');
  const [qualification, setQualification] = useState<QualificationModel>(createInitialQualificationModel());
  const [capturedFacts, setCapturedFacts] = useState<Record<string, unknown>>({});
  const [nextAction, setNextAction] = useState<string>('Initiate opening dialogue');

  const stateMachineRef = useRef<ConversationStateMachine | null>(null);
  const interruptionManagerRef = useRef<InterruptionManager | null>(null);
  const transcriptManagerRef = useRef<TranscriptManager | null>(null);
  const speechInputRef = useRef<BrowserSpeechInputProvider | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const isAiPausedRef = useRef(isAiPaused);

  isAiPausedRef.current = isAiPaused;

  // Initialize state machine & managers
  useEffect(() => {
    const sm = new ConversationStateMachine('idle');
    const im = new InterruptionManager(sm);
    const tm = new TranscriptManager(
      options.callId || `call_live_${Date.now()}`,
      '00000000-0000-0000-0000-000000000001'
    );
    const stt = new BrowserSpeechInputProvider();

    stateMachineRef.current = sm;
    interruptionManagerRef.current = im;
    transcriptManagerRef.current = tm;
    speechInputRef.current = stt;

    const unsubSm = sm.subscribe((state) => {
      setConversationState(state);
    });

    const unsubTm = tm.subscribe((segment) => {
      setTranscripts((prev) => {
        const exists = prev.some((s) => s.id === segment.id);
        if (exists) return prev;
        return [...prev, segment];
      });
    });

    return () => {
      unsubSm();
      unsubTm();
      im.reset();
      stt.stopListening();
    };
  }, [options.callId]);

  /**
   * Synthesizes and plays AI speech via audio element / ElevenLabs endpoint
   */
  const speakAiUtterance = useCallback(
    async (text: string, voiceId?: string) => {
      if (isAiPausedRef.current || !stateMachineRef.current || !interruptionManagerRef.current) {
        return;
      }

      const utteranceId = `utt_${Date.now()}`;
      interruptionManagerRef.current.beginUtterance(utteranceId);

      try {
        // Record transcript entry
        if (transcriptManagerRef.current) {
          await transcriptManagerRef.current.addSegment({
            speaker: 'agent',
            speakerName: options.agentName ? `${options.agentName} (AI)` : 'Rachel (AI)',
            text,
            isFinal: true,
          });
        }

        // Call ElevenLabs synthesis endpoint
        const response = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceId: voiceId || options.agentVoiceId || '21m00Tcm4TlvDq8ikWAM',
          }),
        });

        if (!response.ok) {
          throw new Error(`Synthesis HTTP error: ${response.status}`);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);

        if (!audioPlayerRef.current) {
          audioPlayerRef.current = new Audio();
        }

        const player = audioPlayerRef.current;
        player.src = audioUrl;

        player.onplay = () => {
          setActiveAudioLevel(0.85);
        };

        player.onended = () => {
          setActiveAudioLevel(0);
          URL.revokeObjectURL(audioUrl);
          interruptionManagerRef.current?.finishUtterance(utteranceId);
        };

        await player.play().catch((err) => {
          console.warn('[useVoiceConversation] Playback aborted or failed', err);
          interruptionManagerRef.current?.finishUtterance(utteranceId);
        });
      } catch (err: unknown) {
        console.warn('[useVoiceConversation] Synthesis failed', err);
        interruptionManagerRef.current?.finishUtterance(utteranceId);
      }
    },
    [options.agentVoiceId, options.agentName]
  );

  /**
   * Trigger barge-in immediately when prospect speaks
   */
  const handleBargeIn = useCallback(() => {
    if (interruptionManagerRef.current) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      interruptionManagerRef.current.interrupt('prospect_speech');
      setActiveAudioLevel(0.4);
    }
  }, []);

  /**
   * Starts live conversation loop with Claude reasoning & ElevenLabs speech
   */
  const startConversation = useCallback(async () => {
    if (!speechInputRef.current || !stateMachineRef.current) return;

    stateMachineRef.current.transition('listening');

    await speechInputRef.current.startListening({
      onVAD: (event) => {
        if (event.type === 'speech_start') {
          // If AI is currently speaking, trigger instant barge-in!
          if (interruptionManagerRef.current?.isCurrentlySpeaking()) {
            handleBargeIn();
          } else {
            stateMachineRef.current?.transition('prospect_speaking');
          }
          setActiveAudioLevel(0.65);
        } else if (event.type === 'speech_stop') {
          setActiveAudioLevel(0);
        }
      },
      onTranscript: async (result) => {
        if (interruptionManagerRef.current?.isCurrentlySpeaking()) {
          handleBargeIn();
        }

        if (result.isFinal && result.text.length > 0) {
          // 1. Add prospect transcript
          if (transcriptManagerRef.current) {
            await transcriptManagerRef.current.addSegment({
              speaker: 'prospect',
              text: result.text,
              confidence: result.confidence,
              isFinal: true,
            });
          }

          stateMachineRef.current?.transition('processing');

          let aiText = '';

          try {
            // 2. Call Claude Conversation Engine (/api/ai/turn)
            const aiRes = await fetch('/api/ai/turn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callId: options.callId || `call_live_${Date.now()}`,
                utterance: result.text,
                lead: {
                  id: options.leadId || 'ld_unknown',
                  name: options.leadName || 'Contact',
                  company: options.companyName || 'Business',
                  phone: options.phone || '+18005550199',
                  jobTitle: options.jobTitle,
                },
                campaign: options.campaignId
                  ? { id: options.campaignId, name: options.campaignName || 'Direct Outbound' }
                  : undefined,
                agentName: options.agentName || 'Rachel',
                voiceId: options.agentVoiceId,
              }),
            });

            if (aiRes.ok) {
              const json = await aiRes.json();
              if (json.success && json.data) {
                aiText = json.data.spokenResponse;
                setAiStage(json.data.stage);
                setNextAction(json.data.nextAction || 'Continue discovery');
                if (json.data.qualification) {
                  setQualification(json.data.qualification);
                }
                if (json.data.extractedFacts) {
                  setCapturedFacts((prev) => ({ ...prev, ...json.data.extractedFacts }));
                }
              }
            }
          } catch (err) {
            console.warn('[useVoiceConversation] Claude turn failed, falling back to deterministic reply', err);
          }

          // Fallback if Claude API call failed or in offline testing
          if (!aiText) {
            const fallbackReply = generateDeterministicReply(result.text, {
              leadName: options.leadName,
              companyName: options.companyName,
              agentName: options.agentName || 'Rachel',
            });
            aiText = fallbackReply.text;
          }

          // 3. Synthesize and speak AI response
          await speakAiUtterance(aiText);
        }
      },
      onError: (err) => {
        console.warn('[useVoiceConversation] STT Error', err);
      },
    });
  }, [
    handleBargeIn,
    options.callId,
    options.leadId,
    options.leadName,
    options.companyName,
    options.phone,
    options.jobTitle,
    options.campaignId,
    options.campaignName,
    options.agentName,
    options.agentVoiceId,
    speakAiUtterance,
  ]);

  /**
   * Stops conversation and cleans up all active streams/players
   */
  const stopConversation = useCallback(() => {
    if (speechInputRef.current) {
      speechInputRef.current.stopListening();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = '';
    }
    if (interruptionManagerRef.current) {
      interruptionManagerRef.current.reset();
    }
    if (stateMachineRef.current) {
      stateMachineRef.current.transition('idle');
    }
    setActiveAudioLevel(0);
  }, []);

  const togglePauseAi = useCallback(() => {
    setIsAiPaused((prev) => {
      const next = !prev;
      if (next) {
        handleBargeIn();
      }
      return next;
    });
  }, [handleBargeIn]);

  const clearTranscripts = useCallback(() => {
    transcriptManagerRef.current?.clear();
    setTranscripts([]);
  }, []);

  return {
    conversationState,
    conversationStateLabel: getConversationStateLabel(conversationState),
    transcripts,
    isAiSpeaking: conversationState === 'ai_speaking',
    isProspectSpeaking: conversationState === 'prospect_speaking',
    isAiPaused,
    voiceHealth,
    activeAudioLevel,
    aiStage,
    qualification,
    capturedFacts,
    nextAction,
    startConversation,
    stopConversation,
    speakAiUtterance,
    handleBargeIn,
    togglePauseAi,
    clearTranscripts,
  };
}
