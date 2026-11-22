/**
 * RM AI DIALER — RETELL CRM TOOLS SERVICE (PHASE 4)
 * Executes authenticated, server-validated CRM actions invoked by Claude or Retell turns.
 * Every tool strictly resolves IDs from trusted session context (never trusting unauthenticated LLM IDs).
 */

import { LeadsRepository } from '@/repositories/leads.repository';
import { CallsRepository } from '@/repositories/calls.repository';
import { CampaignsRepository } from '@/repositories/campaigns.repository';
import { AgentsRepository } from '@/repositories/agents.repository';
import { getDevStore } from '@/lib/dev/dev-store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';

export interface TrustedCallContext {
  organizationId: string;
  leadId: string;
  campaignId?: string | null;
  campaignLeadId?: string | null;
  agentId?: string | null;
  agentVersionId?: string | null;
  rmCallId?: string | null;
  retellCallId?: string | null;
  operatorId?: string | null;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data?: Record<string, any>;
  message: string;
  error?: string;
}

export class RetellCRMToolsService {
  private leadsRepo: LeadsRepository;
  private callsRepo: CallsRepository;
  private campaignsRepo: CampaignsRepository;
  private agentsRepo: AgentsRepository;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.leadsRepo = new LeadsRepository(supabase);
    this.callsRepo = new CallsRepository(supabase);
    this.campaignsRepo = new CampaignsRepository(supabase);
    this.agentsRepo = new AgentsRepository(supabase);
  }

  /**
   * Tool: mark_dnc
   * Immediately flags lead as DNC, stops campaign attempts, and records audit trail.
   */
  async markDnc(
    context: TrustedCallContext,
    params: { reason?: string } = {}
  ): Promise<ToolExecutionResult> {
    const reason = params.reason || 'Prospect requested Do Not Call during AI call';

    if (!context.organizationId || !context.leadId) {
      return {
        toolName: 'mark_dnc',
        success: false,
        message: 'Missing trusted organizationId or leadId',
        error: 'Invalid session context',
      };
    }

    try {
      // 1. Mark Lead DNC
      await this.leadsRepo.markDnc(context.leadId, context.organizationId, reason);

      // 2. If in a campaign, update campaign lead status to DNC
      if (context.campaignLeadId) {
        await this.campaignsRepo.updateAttempt(context.campaignLeadId, 'dnc', null);
      }

      // 3. Log call event
      if (context.rmCallId) {
        await this.callsRepo.logEvent({
          organization_id: context.organizationId,
          call_id: context.rmCallId,
          event_type: 'dnc_triggered',
          payload: {
            reason,
            leadId: context.leadId,
            campaignId: context.campaignId || null,
          },
        });
      }

      return {
        toolName: 'mark_dnc',
        success: true,
        data: { leadId: context.leadId, isDnc: true, reason },
        message: `Lead '${context.leadId}' has been permanently marked DNC. All future campaigns and dials are blocked.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark lead DNC';
      return {
        toolName: 'mark_dnc',
        success: false,
        message: 'DNC registration error',
        error: msg,
      };
    }
  }

  /**
   * Tool: schedule_callback
   * Normalizes vague or explicit timing requests and registers a callback task in the CRM.
   */
  async scheduleCallback(
    context: TrustedCallContext,
    params: { requestedTime: string; note?: string; timezone?: string }
  ): Promise<ToolExecutionResult> {
    if (!context.organizationId || !context.leadId) {
      return {
        toolName: 'schedule_callback',
        success: false,
        message: 'Missing trusted organizationId or leadId',
        error: 'Invalid session context',
      };
    }

    const requestedStr = (params.requestedTime || 'tomorrow afternoon').toLowerCase();
    const now = Date.now();
    let scheduledTimestampMs = now + 24 * 3600 * 1000; // default: +24h

    if (requestedStr.includes('afternoon')) {
      // Set to 2:00 PM tomorrow
      const tomorrow = new Date(now + 24 * 3600 * 1000);
      tomorrow.setHours(14, 0, 0, 0);
      scheduledTimestampMs = tomorrow.getTime();
    } else if (requestedStr.includes('morning')) {
      const tomorrow = new Date(now + 24 * 3600 * 1000);
      tomorrow.setHours(10, 0, 0, 0);
      scheduledTimestampMs = tomorrow.getTime();
    } else if (requestedStr.includes('thursday') || requestedStr.includes('friday') || requestedStr.includes('monday')) {
      // Target upcoming day (+2 to +4 days)
      scheduledTimestampMs = now + 48 * 3600 * 1000;
    }

    const isoScheduled = new Date(scheduledTimestampMs).toISOString();
    const note = params.note || `Prospect requested callback: "${params.requestedTime}"`;

    try {
      // Update lead status
      await this.leadsRepo.update(context.leadId, context.organizationId, {
        status: 'contacted',
      });

      // If in campaign, schedule next attempt
      if (context.campaignLeadId) {
        await this.campaignsRepo.updateAttempt(context.campaignLeadId, 'callback', isoScheduled);
      }

      // Log event
      if (context.rmCallId) {
        await this.callsRepo.logEvent({
          organization_id: context.organizationId,
          call_id: context.rmCallId,
          event_type: 'callback_scheduled',
          payload: {
            scheduledTime: isoScheduled,
            note,
            leadId: context.leadId,
          },
        });
      }

      return {
        toolName: 'schedule_callback',
        success: true,
        data: {
          leadId: context.leadId,
          scheduledTime: isoScheduled,
          note,
        },
        message: `Callback successfully scheduled for ${isoScheduled}.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Callback scheduling error';
      return {
        toolName: 'schedule_callback',
        success: false,
        message: 'Failed to schedule callback',
        error: msg,
      };
    }
  }

  /**
   * Tool: request_handoff
   * Escalates call for pricing, logistics commitments, or explicit human representative requests.
   */
  async requestHandoff(
    context: TrustedCallContext,
    params: {
      reason: 'pricing' | 'commercial_negotiation' | 'logistics_commitment' | 'human_requested' | 'ai_uncertainty';
      priority?: 'high' | 'medium' | 'low';
      notes?: string;
    }
  ): Promise<ToolExecutionResult> {
    const priority = params.priority || (params.reason === 'human_requested' || params.reason === 'pricing' ? 'high' : 'medium');
    const notes = params.notes || `Handoff escalated: ${params.reason}`;

    try {
      if (context.rmCallId) {
        await this.callsRepo.logEvent({
          organization_id: context.organizationId,
          call_id: context.rmCallId,
          event_type: 'handoff_requested',
          payload: {
            reason: params.reason,
            priority,
            notes,
            leadId: context.leadId,
            agentId: context.agentId,
          },
        });
      }

      return {
        toolName: 'request_handoff',
        success: true,
        data: {
          leadId: context.leadId,
          reason: params.reason,
          priority,
          notes,
        },
        message: `Handoff request logged with priority '${priority}' for reason '${params.reason}'.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Handoff request failed';
      return {
        toolName: 'request_handoff',
        success: false,
        message: 'Handoff logging failed',
        error: msg,
      };
    }
  }

  /**
   * Tool: update_qualification
   * Persists extracted commercial qualification facts without fabricating missing values.
   */
  async updateQualification(
    context: TrustedCallContext,
    facts: {
      decisionMaker?: string;
      materialType?: string;
      volume?: string;
      frequency?: string;
      location?: string;
      timing?: string;
      supplier?: string;
      interestLevel?: string;
    }
  ): Promise<ToolExecutionResult> {
    if (!context.organizationId || !context.leadId) {
      return {
        toolName: 'update_qualification',
        success: false,
        message: 'Missing trusted organizationId or leadId',
        error: 'Invalid session context',
      };
    }

    try {
      const sanitizedFacts: Record<string, string> = {};
      if (facts.decisionMaker) sanitizedFacts.decisionMaker = facts.decisionMaker;
      if (facts.materialType) sanitizedFacts.materialType = facts.materialType;
      if (facts.volume) sanitizedFacts.volume = facts.volume;
      if (facts.frequency) sanitizedFacts.frequency = facts.frequency;
      if (facts.location) sanitizedFacts.location = facts.location;
      if (facts.timing) sanitizedFacts.timing = facts.timing;
      if (facts.supplier) sanitizedFacts.supplier = facts.supplier;
      if (facts.interestLevel) sanitizedFacts.interestLevel = facts.interestLevel;

      // Update lead custom_fields with qualification updates
      const lead = await this.leadsRepo.getById(context.leadId, context.organizationId);
      if (lead) {
        const existingMeta = (lead.custom_fields || {}) as Record<string, any>;
        const updatedMeta = {
          ...existingMeta,
          qualification: {
            ...(existingMeta.qualification || {}),
            ...sanitizedFacts,
            updatedAt: new Date().toISOString(),
          },
        };

        await this.leadsRepo.update(context.leadId, context.organizationId, {
          custom_fields: updatedMeta as Json,
          status: facts.interestLevel === 'High' ? 'qualified' : lead.status,
        });
      }

      if (context.rmCallId) {
        await this.callsRepo.logEvent({
          organization_id: context.organizationId,
          call_id: context.rmCallId,
          event_type: 'qualification_updated',
          payload: sanitizedFacts,
        });
      }

      return {
        toolName: 'update_qualification',
        success: true,
        data: sanitizedFacts,
        message: `Qualification facts updated: ${Object.keys(sanitizedFacts).join(', ')}.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Qualification update failed';
      return {
        toolName: 'update_qualification',
        success: false,
        message: 'Failed to update qualification facts',
        error: msg,
      };
    }
  }

  /**
   * Tool: lookup_rm_knowledge
   * Queries verified organizational knowledge for the active agent.
   */
  async lookupRmKnowledge(
    context: TrustedCallContext,
    params: { category?: string; query: string }
  ): Promise<ToolExecutionResult> {
    if (!context.agentId) {
      return {
        toolName: 'lookup_rm_knowledge',
        success: false,
        message: 'No active agent ID in session context',
        error: 'Missing agent ID',
      };
    }

    try {
      const items = await this.agentsRepo.listKnowledge(context.agentId, context.organizationId);
      const queryLower = (params.query || '').toLowerCase();

      const matched = items.filter((item) => {
        if (params.category && item.category.toLowerCase() !== params.category.toLowerCase()) {
          return false;
        }
        return (
          item.title.toLowerCase().includes(queryLower) ||
          item.content.toLowerCase().includes(queryLower)
        );
      });

      return {
        toolName: 'lookup_rm_knowledge',
        success: true,
        data: {
          resultsCount: matched.length,
          snippets: matched.slice(0, 3).map((m) => ({ category: m.category, title: m.title, content: m.content })),
        },
        message: `Found ${matched.length} verified knowledge items matching query.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Knowledge lookup failed';
      return {
        toolName: 'lookup_rm_knowledge',
        success: false,
        message: 'Failed to query RM knowledge',
        error: msg,
      };
    }
  }

  /**
   * Dynamic tool dispatcher executing named tools with trusted context
   */
  async executeTool(
    context: TrustedCallContext,
    toolName: string,
    argumentsPayload: Record<string, any> = {}
  ): Promise<ToolExecutionResult> {
    switch (toolName) {
      case 'mark_dnc':
        return this.markDnc(context, argumentsPayload);
      case 'schedule_callback':
        return this.scheduleCallback(context, argumentsPayload as any);
      case 'request_handoff':
        return this.requestHandoff(context, argumentsPayload as any);
      case 'update_qualification':
        return this.updateQualification(context, argumentsPayload as any);
      case 'lookup_rm_knowledge':
        return this.lookupRmKnowledge(context, argumentsPayload as any);
      default:
        return {
          toolName,
          success: false,
          message: `Unknown CRM tool '${toolName}'.`,
          error: 'Tool not recognized',
        };
    }
  }
}
