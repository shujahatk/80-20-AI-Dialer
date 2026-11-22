/**
 * RM AI DIALER — RETELL AGENT SERVICE (PHASE 2)
 * Manages Retell Agent lifecycle, synchronization with RM DB records,
 * voice selection, validation, and reference publishing.
 */

import { RetellProvider, retellProvider } from './RetellProvider';
import { RetellClient, retellClient } from './RetellClient';
import type { RetellAgentReference, RetellProviderHealth } from './types';
import { AgentsRepository, type AgentRow, type AgentVersionRow } from '@/repositories/agents.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface AgentSyncResult {
  success: boolean;
  retellAgentId?: string | null;
  syncStatus: 'synced' | 'failed';
  error?: string;
}

export interface AgentValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class RetellAgentService {
  private provider: RetellProvider;
  private client: RetellClient;
  private repo?: AgentsRepository;

  constructor(
    provider: RetellProvider = retellProvider,
    client: RetellClient = retellClient,
    supabase?: SupabaseClient<Database>
  ) {
    this.provider = provider;
    this.client = client;
    if (supabase) {
      this.repo = new AgentsRepository(supabase);
    }
  }

  /**
   * Retrieves an agent from Retell
   */
  async getAgent(agentId: string): Promise<RetellAgentReference> {
    return this.provider.getAgent(agentId);
  }

  /**
   * Lists available agents from Retell
   */
  async listAgents(): Promise<RetellAgentReference[]> {
    return this.provider.listAgents();
  }

  /**
   * Checks Retell Agent Service readiness
   */
  async checkReadiness(): Promise<RetellProviderHealth> {
    return this.provider.getReadiness();
  }

  /**
   * Lists supported Retell voices
   */
  async listVoices(): Promise<
    Array<{
      voice_id: string;
      voice_name: string;
      provider: string;
      gender: string;
      accent: string;
      preview_audio_url?: string;
    }>
  > {
    return this.client.listVoices();
  }

  /**
   * Validates RM Agent configuration before synchronization / publishing
   */
  validateAgent(
    agent: Partial<AgentRow>,
    version?: Partial<AgentVersionRow> | null
  ): AgentValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!agent.name || agent.name.trim().length < 2) {
      errors.push('Agent Name is required and must be at least 2 characters.');
    }

    if (!agent.persona || agent.persona.trim().length < 5) {
      errors.push('Role / Persona is required (e.g. "RM Purchasing Specialist").');
    }

    if (!version?.voice_id) {
      errors.push('A valid Retell Voice must be selected.');
    }

    if (!version?.greeting || version.greeting.trim().length < 5) {
      warnings.push('Opening message is short. Consider configuring a clear greeting.');
    }

    if (!version?.system_prompt || version.system_prompt.trim().length < 20) {
      errors.push('System Prompt / Mandate is required and must provide clear instructions.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Creates or updates a Retell agent corresponding to the RM Agent entity
   */
  async syncAgent(
    agent: AgentRow,
    version?: AgentVersionRow | null,
    organizationId?: string
  ): Promise<AgentSyncResult> {
    const validation = this.validateAgent(agent, version);
    if (!validation.isValid) {
      return {
        success: false,
        syncStatus: 'failed',
        error: `Agent validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // If client is not live-configured, generate or maintain a deterministic mock reference
    if (!this.client.isConfigured) {
      const generatedRetellId = agent.retell_agent_id || `retell_ag_${agent.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      return {
        success: true,
        retellAgentId: generatedRetellId,
        syncStatus: 'synced',
      };
    }

    try {
      const payload = {
        agent_name: `${agent.name} (RM ${agent.id.slice(0, 8)})`,
        voice_id: version?.voice_id || '11labs-Adrian',
        language: 'en-US',
        responsiveness: 1.0,
        interruption_sensitivity: 0.8,
      };

      let retellAgent: RetellAgentReference;
      if (agent.retell_agent_id) {
        retellAgent = await this.client.updateAgent(agent.retell_agent_id, payload);
      } else {
        retellAgent = await this.client.createAgent(payload);
      }

      return {
        success: true,
        retellAgentId: retellAgent.agent_id,
        syncStatus: 'synced',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retell agent synchronization failed';
      return {
        success: false,
        retellAgentId: agent.retell_agent_id,
        syncStatus: 'failed',
        error: msg,
      };
    }
  }
}

export const retellAgentService = new RetellAgentService();
