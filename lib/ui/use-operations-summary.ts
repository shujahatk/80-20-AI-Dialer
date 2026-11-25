'use client';

import { useEffect, useState } from 'react';
import type { Campaign, Lead } from '@/types';
import { authenticatedFetch } from '@/lib/api/client';
import {
  buildOperationsSummary,
  emptyOperationsSummary,
  type OperationsAgent,
  type OperationsCall,
  type OperationsSummary,
} from './operations-summary';

function mapCall(raw: Record<string, unknown>): OperationsCall {
  const lead = (raw.lead as Record<string, unknown> | undefined) || {};
  return {
    id: String(raw.id),
    leadName: String(lead.full_name || raw.lead_name || 'Unknown lead'),
    company: String(lead.company_name || raw.company || '—'),
    phone: String(lead.phone_e164 || lead.phone || raw.phone || '—'),
    agentName: String(raw.agent_name || raw.operator_name || 'RM AI Agent'),
    outcome: String(raw.outcome || raw.status || 'completed'),
    outcomeLabel: String(raw.outcome || raw.status || 'Completed'),
    status: String(raw.status || 'completed'),
    durationSeconds: Number(raw.duration_seconds) || 0,
    startedAt: raw.started_at ? String(raw.started_at) : undefined,
    sentimentLabel: raw.sentiment ? String(raw.sentiment) : undefined,
  };
}

export function useOperationsSummary() {
  const [data, setData] = useState<OperationsSummary>(emptyOperationsSummary());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [leadsRes, callsRes, campaignsRes, agentsRes] = await Promise.all([
          authenticatedFetch('/api/leads?limit=100'),
          authenticatedFetch('/api/calls?limit=50'),
          authenticatedFetch('/api/campaigns?limit=50'),
          authenticatedFetch('/api/agents'),
        ]);

        const [leadsJson, callsJson, campaignsJson, agentsJson] = await Promise.all([
          leadsRes.json().catch(() => ({})),
          callsRes.json().catch(() => ({})),
          campaignsRes.json().catch(() => ({})),
          agentsRes.json().catch(() => ({})),
        ]);

        if (cancelled) return;

        const leads: Lead[] = Array.isArray(leadsJson.data) ? leadsJson.data : [];
        const calls: OperationsCall[] = Array.isArray(callsJson.data)
          ? callsJson.data.map((item: Record<string, unknown>) => mapCall(item))
          : [];
        const campaigns: Campaign[] = Array.isArray(campaignsJson.data) ? campaignsJson.data : [];
        const agents: OperationsAgent[] = Array.isArray(agentsJson.agents)
          ? agentsJson.agents
          : Array.isArray(agentsJson.data)
            ? agentsJson.data
            : [];

        setData(
          buildOperationsSummary({
            leads,
            leadTotal: Number(leadsJson.totalCount) || leads.length,
            leadMetrics: leadsJson.metrics,
            calls,
            campaigns,
            agents,
          })
        );
        setUpdatedAt(new Date());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load operations data');
          setData(emptyOperationsSummary());
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error, updatedAt };
}
