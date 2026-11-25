'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api/client';
import { AcousticTelemetryBar } from '@/features/dialer/AcousticTelemetryBar';
import { LeadContextPanel } from '@/features/dialer/LeadContextPanel';
import { ActiveQueuePanel } from '@/features/dialer/ActiveQueuePanel';
import { ProgressionRibbon } from '@/features/dialer/ProgressionRibbon';
import { AudioVisualizer } from '@/features/dialer/AudioVisualizer';
import { CallControlsBar } from '@/features/dialer/CallControlsBar';
import { LiveTranscriptFeed } from '@/features/dialer/LiveTranscriptFeed';
import { LiveIntelligencePanel } from '@/features/dialer/LiveIntelligencePanel';
import { CallbacksQueueStudio } from '@/features/dialer/CallbacksQueueStudio';
import { HandoffQueueStudio } from '@/features/dialer/HandoffQueueStudio';
import { ManualDialpadStudio } from '@/features/dialer/ManualDialpadStudio';
import { useTelephony } from '@/lib/telephony/use-telephony';
import { useVoiceConversation } from '@/lib/voice/use-voice-conversation';
import type { CampaignRecord } from '@/lib/dev/dev-store';
import type { Lead, LeadStatus } from '@/types';

type QueueLead = Record<string, unknown> & { id?: string };

function emptyLead(campaign: CampaignRecord | null): Lead {
  return {
    id: '',
    name: 'No lead selected',
    title: '',
    company: '',
    phone: '',
    email: '',
    timezone: '',
    localTime: '',
    campaignId: campaign?.id || 'direct',
    campaignName: campaign?.name || 'Direct outbound',
    status: 'new',
    tags: [],
    attempts: 0,
    maxAttempts: campaign?.max_attempts_per_lead || 4,
  };
}

function toWorkstationLead(row: QueueLead | undefined, campaign: CampaignRecord | null): Lead {
  if (!row?.id) return emptyLead(campaign);
  return {
    id: String(row.id),
    name: String(row.full_name || row.name || ''),
    title: String(row.job_title || row.title || ''),
    company: String(row.company_name || row.company || ''),
    phone: String(row.phone_e164 || row.phone || ''),
    email: String(row.email || ''),
    timezone: String(row.timezone || ''),
    localTime: '',
    campaignId: campaign?.id || 'direct',
    campaignName: campaign?.name || 'Direct outbound',
    status: (String(row.status || 'new') as LeadStatus),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    attempts: Number(row.attempts || 0),
    maxAttempts: campaign?.max_attempts_per_lead || 4,
  };
}

function WorkstationContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') || searchParams.get('view');
  const actionParam = searchParams.get('action');

  if (tabParam === 'callbacks') {
    return <CallbacksQueueStudio />;
  }

  if (tabParam === 'handoffs') {
    return <HandoffQueueStudio />;
  }

  if (actionParam === 'dial') {
    return <ManualDialpadStudio />;
  }

  return <WorkstationCockpit />;
}

function WorkstationCockpit() {
  const searchParams = useSearchParams();
  const dialParam = searchParams.get('dial');
  const leadIdParam = searchParams.get('leadId');
  const autodialParam = searchParams.get('autodial');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [activeCampaign, setActiveCampaign] = useState<CampaignRecord | null>(null);
  const hasAutoDialedRef = React.useRef(false);

  const {
    callState,
    statusLabel,
    activeCall,
    isMuted,
    durationSeconds,
    micVolume,
    remoteVolume,
    errorMessage,
    startCall,
    endCall,
    toggleMute,
    sendDtmf,
    submitDisposition,
    resetCallSession,
  } = useTelephony();

  const currentDbLead = leads[currentLeadIndex];
  const nextDbLead = leads[currentLeadIndex + 1];
  const currentLead = toWorkstationLead(currentDbLead, activeCampaign);
  const nextLead = toWorkstationLead(nextDbLead, activeCampaign);

  // Handle specific leadIdParam or direct manual dial query parameter
  useEffect(() => {
    let isCancelled = false;

    async function handleTargetLead() {
      if (leadIdParam) {
        try {
          const res = await authenticatedFetch(`/api/leads/${leadIdParam}`);
          const json = await res.json();
          if (json.success && json.data && !isCancelled) {
            const row = json.data;
            const targetLead: QueueLead = {
              id: row.id,
              full_name: row.name,
              name: row.name,
              phone_e164: row.phone,
              phone: row.phone,
              company_name: row.company,
              company: row.company,
              job_title: row.title,
              title: row.title,
              email: row.email,
              status: row.status,
              attempts: row.attempts || 0,
            };
            setLeads((prev) => {
              const existingIdx = prev.findIndex((l) => l.id === targetLead.id);
              if (existingIdx >= 0) {
                const nextList = [...prev];
                nextList[existingIdx] = { ...nextList[existingIdx], ...targetLead };
                setCurrentLeadIndex(existingIdx);
                return nextList;
              }
              setCurrentLeadIndex(0);
              return [targetLead, ...prev];
            });

            if (autodialParam === 'true' && !hasAutoDialedRef.current && row.status !== 'dnc') {
              hasAutoDialedRef.current = true;
              startCall(row.id, activeCampaign?.id, String(row.phone_e164 || row.phone || '')).catch(console.error);
            }
            return;
          }
        } catch (err) {
          console.warn('Failed to load lead by ID for workstation:', err);
        }
      }

      if (dialParam && dialParam.trim()) {
        const decodedPhone = decodeURIComponent(dialParam).trim();
        const adHocLead: QueueLead = {
          id: leadIdParam || 'manual_' + Date.now(),
          full_name: `Direct Dial (${decodedPhone})`,
          phone_e164: decodedPhone,
          phone: decodedPhone,
          company_name: 'Manual Call',
          status: 'new',
          attempts: 0,
        };
        setLeads((prev) => {
          const existingIdx = prev.findIndex((l) => (l.phone_e164 || l.phone) === decodedPhone);
          if (existingIdx >= 0) {
            setCurrentLeadIndex(existingIdx);
            return prev;
          }
          setCurrentLeadIndex(0);
          return [adHocLead, ...prev];
        });

        if (autodialParam === 'true' && !hasAutoDialedRef.current) {
          hasAutoDialedRef.current = true;
          startCall(adHocLead.id as string, activeCampaign?.id, String(adHocLead.phone_e164 || adHocLead.phone || '')).catch(console.error);
        }
      }
    }

    handleTargetLead();
    return () => {
      isCancelled = true;
    };
  }, [leadIdParam, dialParam, autodialParam, activeCampaign?.id, startCall]);

  // Phase 6 & 7 Voice, Conversation Engine & Sales Intelligence Hook
  const {
    transcripts,
    startConversation,
    stopConversation,
    togglePauseAi,
    conversationState,
    activeAudioLevel,
    aiStage,
    qualification,
    capturedFacts,
    nextAction,
  } = useVoiceConversation({
    callId: activeCall?.callId,
    leadName: currentLead.name,
    companyName: currentLead.company,
  });

  // Sync voice conversation loop with connected call transport state
  useEffect(() => {
    if (callState === 'connected') {
      startConversation();
    } else if (callState === 'completed' || callState === 'idle' || callState === 'busy' || callState === 'failed') {
      stopConversation();
    }
  }, [callState, startConversation, stopConversation]);

  // Load real leads and campaigns
  useEffect(() => {
    async function loadWorkspace() {
      try {
        const [leadsRes, campRes] = await Promise.all([
          authenticatedFetch('/api/leads?limit=10'),
          authenticatedFetch('/api/campaigns?limit=1'),
        ]);
        const leadsData = await leadsRes.json();
        const campData = await campRes.json();

        if (leadsData.success && Array.isArray(leadsData.data) && leadsData.data.length > 0) {
          setLeads(leadsData.data);
        }
        if (campData.success && Array.isArray(campData.data) && campData.data.length > 0) {
          setActiveCampaign(campData.data[0]);
        }
      } catch (err) {
        console.warn('Notice: Workstation offline fallback loaded', err);
      }
    }
    loadWorkspace();
  }, []);

  const isCallActive =
    callState === 'connected' ||
    callState === 'dialing' ||
    callState === 'preparing' ||
    callState === 'ringing';

  return (
    <div className="rm-page flex w-full flex-col bg-background text-on-surface">
      {/* 1. TOP DIAGNOSTICS & TELEMETRY STRIP */}
      <AcousticTelemetryBar
        callState={callState}
        campaignName={activeCampaign?.name || 'Direct outbound'}
        leadName={currentLead.id ? currentLead.name : undefined}
        statusLabel={statusLabel}
        onToggleDiagnostics={() => setShowDiagnostics((prev) => !prev)}
        showDiagnostics={showDiagnostics}
      />

      {errorMessage && (
        <div className="mx-6 mt-4 p-3 bg-error-container text-on-error-container rounded-lg border border-error/20 flex items-center justify-between text-xs">
          <span>{errorMessage}</span>
          <button onClick={resetCallSession} className="underline font-semibold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSTATION 3-COLUMN COCKPIT */}
      <div className="grid w-full grid-cols-1 items-start gap-3 p-3 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px] xl:p-4">
        {/* LEFT COLUMN: Lead Context & Active Queue */}
        <aside className="flex flex-col gap-3 xl:sticky xl:top-16">
          <LeadContextPanel lead={currentLead} />

          <ActiveQueuePanel
            currentPosition={leads.length ? currentLeadIndex + 1 : 0}
            totalQueue={leads.length}
            pendingCount={Math.max(0, leads.length - currentLeadIndex - 1)}
            campaignName={activeCampaign?.name || 'Direct outbound'}
            upNextLead={
              nextLead.id
                ? {
                    name: nextLead.name,
                    title: nextLead.title,
                    phone: nextLead.phone,
                  }
                : undefined
            }
            onSkip={() => setCurrentLeadIndex((prev) => Math.min(prev + 1, Math.max(0, leads.length - 1)))}
          />
        </aside>

        {/* MIDDLE COLUMN: Audio Visualizer & Call Controls */}
        <section className="panel flex min-h-[520px] flex-col overflow-visible p-0">
          <ProgressionRibbon
            embedded
            callState={callState}
            conversationState={conversationState}
            durationSeconds={durationSeconds}
            errorMessage={errorMessage}
          />

          <AudioVisualizer
            embedded
            operatorName="Operator"
            leadName={
              activeCall
                ? activeCall.lead.full_name
                : currentLead.id
                  ? currentLead.name
                  : 'No lead selected'
            }
            callState={callState}
            micVolume={Math.max(micVolume, Math.round(activeAudioLevel * 100))}
            remoteVolume={remoteVolume}
            isMuted={isMuted}
          />

          <CallControlsBar
            embedded
            onStartCall={async () => {
              if (!currentLead.id || currentLead.status === 'dnc') return;
              try {
                await startCall(currentLead.id, activeCampaign?.id, currentLead.phone ? String(currentLead.phone) : undefined);
              } catch {
                // error is captured in useTelephony errorMessage state
              }
            }}
            canStartCall={Boolean(currentLead.id && currentLead.phone && currentLead.status !== 'dnc')}
            isStartingCall={callState === 'preparing'}
            onHangup={() => {
              stopConversation();
              endCall();
            }}
            onMuteToggle={toggleMute}
            isMuted={isMuted}
            onPauseAiToggle={togglePauseAi}
            onSendDtmf={sendDtmf}
            onOutcomeSelect={(outcome) => {
              submitDisposition(outcome);
              if (callState === 'completed' || callState === 'idle') {
                setCurrentLeadIndex((prev) => Math.min(prev + 1, Math.max(0, leads.length - 1)));
              }
            }}
            isCallActive={isCallActive}
          />
        </section>

        {/* RIGHT COLUMN: Live Transcript & Qualification Summary */}
        <aside className="flex flex-col gap-3 lg:col-span-2 xl:col-span-1">
          <LiveTranscriptFeed entries={transcripts} />
          <LiveIntelligencePanel
            currentStage={aiStage}
            prospectIntent={isCallActive ? 'Live Conversation' : 'Ready'}
            factsCaptured={capturedFacts}
            callGoal={activeCampaign?.name ? `Qualify for ${activeCampaign.name}` : 'Qualify the current lead'}
            tacticalRecommendation={nextAction}
            qualification={qualification}
          />
        </aside>
      </div>
    </div>
  );
}

export default function WorkstationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading Workstation Cockpit...</div>}>
      <WorkstationContent />
    </Suspense>
  );
}
