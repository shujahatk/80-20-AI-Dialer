'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CallAuditHeader } from '@/features/calls/CallAuditHeader';
import { CallDetailDrawer } from '@/features/calls/CallDetailDrawer';
import { PageShell } from '@/components/ui/page-shell';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { callOutcomeLabel, callOutcomeTone } from '@/lib/ui/status';
import type { Call, CallOutcome, CallStatus, TranscriptEntry } from '@/types';

function mapCall(c: Record<string, unknown>): Call {
  const durationSec = Number(c.duration_seconds) || 0;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const lead = c.lead as Record<string, unknown> | undefined;
  const startedAt = c.started_at ? String(c.started_at) : undefined;
  const sentiment = typeof c.sentiment === 'string' ? c.sentiment : '';
  return {
    id: String(c.id),
    sessionId: String(c.provider_call_id || c.id),
    leadId: String(c.lead_id || 'unknown'),
    leadName: lead ? String(lead.full_name || lead.name || 'Direct Contact') : 'Direct Contact',
    leadTitle: lead ? String(lead.job_title || lead.title || 'Contact') : 'Contact',
    company: lead ? String(lead.company_name || lead.company || 'Account') : 'Account',
    phone: lead ? String(lead.phone_e164 || lead.phone || '—') : '—',
    campaignId: String(c.campaign_id || 'direct'),
    campaignName: String(c.campaign_name || 'Direct Calling'),
    agentId: String(c.operator_id || c.agent_id || 'operator'),
    agentName: String(c.agent_name || 'RM AI Assistant'),
    status: (c.status || 'completed') as CallStatus,
    outcome: (c.outcome || 'connected') as CallOutcome,
    outcomeLabel: String(c.outcome || 'Completed'),
    durationSeconds: durationSec,
    durationFormatted: `${mins}:${secs.toString().padStart(2, '0')}`,
    timestamp: startedAt
      ? new Date(startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Unknown',
    sentimentScore: 0,
    sentimentLabel: sentiment && sentiment !== '—' ? sentiment : '',
    audioUrl: typeof c.recording_url === 'string' ? c.recording_url : undefined,
    transcript: [],
  };
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCallTranscripts, setSelectedCallTranscripts] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [startedAtById, setStartedAtById] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadCalls() {
      try {
        const res = await fetch('/api/calls?limit=50');
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const timestamps: Record<string, string> = {};
          const mapped: Call[] = json.data.map((c: Record<string, unknown>) => {
            const mappedCall = mapCall(c);
            if (c.started_at) timestamps[mappedCall.id] = String(c.started_at);
            return mappedCall;
          });
          setCalls(mapped);
          setStartedAtById(timestamps);
        } else {
          setCalls([]);
        }
      } catch {
        setCalls([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadCalls();
  }, []);

  useEffect(() => {
    async function loadTranscripts() {
      if (!selectedCallId) return;
      try {
        const res = await fetch(`/api/calls/${selectedCallId}/transcripts`);
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const mapped: TranscriptEntry[] = json.data.map((t: Record<string, unknown>, idx: number) => ({
            id: String(t.id || `tr_${idx}`),
            speaker: t.speaker === 'ai' ? 'ai' : 'prospect',
            speakerName: t.speaker === 'ai' ? 'RM AI Assistant' : 'Prospect',
            text: String(t.text || ''),
            timestamp: new Date(Number(t.started_at_ms) || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            timeSeconds: Math.floor((Number(t.started_at_ms) || 0) / 1000),
          }));
          setSelectedCallTranscripts(mapped);
        } else {
          setSelectedCallTranscripts([]);
        }
      } catch {
        setSelectedCallTranscripts([]);
      }
    }
    loadTranscripts();
  }, [selectedCallId]);

  const filteredCalls = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return calls.filter((call) => {
      if (q) {
        const haystack = `${call.leadName} ${call.company} ${call.phone} ${call.outcomeLabel}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (outcomeFilter !== 'All') {
        const label = callOutcomeLabel(call.outcome, call.outcomeLabel).toLowerCase();
        if (!label.includes(outcomeFilter.toLowerCase()) && !String(call.outcome).toLowerCase().includes(outcomeFilter.toLowerCase())) {
          return false;
        }
      }
      if (dateFilter !== 'All') {
        const started = startedAtById[call.id];
        if (!started) return false;
        const ts = new Date(started).getTime();
        if (Number.isNaN(ts)) return false;
        const days = dateFilter === 'Today' ? 1 : dateFilter === 'Last 7d' ? 7 : 31;
        if (now - ts > days * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [calls, search, outcomeFilter, dateFilter, startedAtById]);

  const selectedCall = calls.find((call) => call.id === selectedCallId) ?? null;
  const outcomeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredCalls.forEach((call) => {
      const label = callOutcomeLabel(call.outcome, call.outcomeLabel);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, [filteredCalls]);
  const outcomeMax = Math.max(...outcomeCounts.map(([, count]) => count), 1);

  return (
    <PageShell>
      <CallAuditHeader
        onSearchChange={setSearch}
        onFilterOutcome={setOutcomeFilter}
        onDateChange={setDateFilter}
      />
      {outcomeCounts.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {outcomeCounts.map(([label, count]) => (
            <div key={label} className="rounded-xl border border-black/[0.07] bg-white p-3 dark:border-white/[0.08] dark:bg-[#121614]">
              <div className="text-[11.5px] text-neutral-500 dark:text-neutral-400">{label}</div>
              <div className="mt-1 font-mono text-[20px] tabular-nums text-[#1c3128] dark:text-neutral-50">{count}</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-secondary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.round((count / outcomeMax) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        <div className="max-h-[70vh] overflow-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Lead</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>
                    <TableSkeleton rows={8} cols={6} />
                  </td>
                </tr>
              ) : filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No matching calls" description="Completed calls, transcripts, and recordings will appear here." />
                  </td>
                </tr>
              ) : (
                filteredCalls.map((call) => (
                  <TableRow
                    key={call.id}
                    className={`cursor-pointer transition-colors duration-150 hover:bg-primary/[0.04] ${selectedCallId === call.id ? 'bg-primary/[0.07]' : ''}`}
                    onClick={() => setSelectedCallId(call.id)}
                  >
                    <TableCell>
                      <div className="font-semibold text-on-surface">{call.leadName}</div>
                      <div className="text-[12px] text-on-surface-variant">{call.company}</div>
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{call.phone}</TableCell>
                    <TableCell>{call.agentName}</TableCell>
                    <TableCell className="font-mono tabular-nums">{call.durationFormatted}</TableCell>
                    <TableCell>
                      <Badge tone={callOutcomeTone(call.outcome)}>{callOutcomeLabel(call.outcome, call.outcomeLabel)}</Badge>
                    </TableCell>
                    <TableCell>{call.timestamp}</TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>
      <CallDetailDrawer
        call={selectedCall || null}
        transcripts={selectedCallTranscripts}
        open={Boolean(selectedCallId && selectedCall)}
        onClose={() => setSelectedCallId(null)}
      />
    </PageShell>
  );
}
