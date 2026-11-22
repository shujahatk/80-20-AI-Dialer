'use client';

import React, { useEffect, useState } from 'react';
import type { Call, TranscriptEntry } from '@/types';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { DualTrackAudioPlayer } from '@/features/calls/DualTrackAudioPlayer';
import { AiSummaryBento } from '@/features/calls/AiSummaryBento';
import { SynchronizedTranscript } from '@/features/calls/SynchronizedTranscript';
import { callOutcomeLabel, callOutcomeTone } from '@/lib/ui/status';

export function CallDetailDrawer({
  call,
  transcripts,
  open,
  onClose,
}: {
  call: Call | null;
  transcripts: TranscriptEntry[];
  open: boolean;
  onClose: () => void;
}) {
  const [recordingUrl, setRecordingUrl] = useState<string | undefined>(call?.audioUrl);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);

  useEffect(() => {
    if (!open || !call?.id) return;
    let cancelled = false;
    setRecordingUrl(call.audioUrl);
    setPlaybackSeconds(0);

    fetch(`/api/calls/${call.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        const recording = json.data?.recording as { storage_path?: string } | undefined;
        const url = recording?.storage_path || json.data?.audioUrl;
        if (typeof url === 'string' && url.length > 0) {
          setRecordingUrl(url);
        }
      })
      .catch(() => {
        /* keep existing url */
      });

    return () => {
      cancelled = true;
    };
  }, [open, call?.id, call?.audioUrl]);

  if (!call) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      widthClassName="max-w-3xl"
      title={call.leadName}
      subtitle={`${call.company} · ${call.phone}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={callOutcomeTone(call.outcome)}>{callOutcomeLabel(call.outcome, call.outcomeLabel)}</Badge>
          <Badge>{call.agentName}</Badge>
          <Badge tone="info">{call.durationFormatted}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div>
            <div className="text-on-surface-variant">Number</div>
            <div className="font-mono font-medium text-on-surface">{call.phone}</div>
          </div>
          <div>
            <div className="text-on-surface-variant">Date</div>
            <div className="font-medium text-on-surface">{call.timestamp}</div>
          </div>
          <div>
            <div className="text-on-surface-variant">Campaign</div>
            <div className="font-medium text-on-surface">{call.campaignName}</div>
          </div>
          <div>
            <div className="text-on-surface-variant">Recording</div>
            <div className="font-medium text-on-surface">{recordingUrl ? 'Available' : 'Unavailable'}</div>
          </div>
        </div>
        <DualTrackAudioPlayer src={recordingUrl} durationSeconds={call.durationSeconds} onTimeChange={setPlaybackSeconds} />
        <AiSummaryBento call={call} />
        <SynchronizedTranscript
          turns={transcripts.length > 0 ? transcripts : call.transcript ?? []}
          currentPlaybackSeconds={playbackSeconds}
        />
      </div>
    </Drawer>
  );
}
