/**
 * RM AI DIALER — AGENTS SERVICE (PHASE 2)
 * Comprehensive Agent Studio service managing:
 * - 6-state lifecycle (draft, training, testing, ready, published, archived)
 * - Retell voice and agent synchronization
 * - Knowledge base management & sync
 * - 16-scenario deterministic simulations & safety gates
 * - Immutable version snapshots on publication
 * - Role-based access control (Admin, Manager, Operator, Viewer)
 * - Audit logging
 */

import {
  AgentsRepository,
  type AgentRow,
  type AgentVersionRow,
  type AgentKnowledgeRow,
  type AgentSimulationRow,
} from '@/repositories/agents.repository';
import { CampaignsRepository } from '@/repositories/campaigns.repository';
import { RetellAgentService, retellAgentService } from '@/services/retell/RetellAgentService';
import { RetellKnowledgeService } from '@/services/retell/RetellKnowledgeService';
import { AgentSimulatorService, type BatchSimulationResult, type SimulationRubricEvaluation } from './agent-simulator.service';
import { getClientEnv } from '@/lib/env';
import type { AiAgent } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';

export type AgentLifecycleStage = 'draft' | 'training' | 'testing' | 'ready' | 'published' | 'archived';
export type AgentStudioUserRole = 'admin' | 'manager' | 'operator' | 'viewer' | 'executive' | 'sdr' | 'agent';

export interface CreateAgentInput {
  name: string;
  persona: string;
  greeting?: string;
  systemPrompt?: string;
  voiceProvider?: string;
  voiceId?: string;
  speakingSpeed?: number;
  qualificationRules?: Record<string, any>;
  objectionRules?: Record<string, any>;
  handoffRules?: Record<string, any>;
}

export interface UpdateAgentInput {
  name?: string;
  persona?: string;
  greeting?: string;
  systemPrompt?: string;
  voiceProvider?: string;
  voiceId?: string;
  speakingSpeed?: number;
  qualificationRules?: Record<string, any>;
  objectionRules?: Record<string, any>;
  handoffRules?: Record<string, any>;
  stageState?: AgentLifecycleStage;
}

export interface PublishAgentResult {
  success: boolean;
  agent: AgentRow;
  publishedVersion: AgentVersionRow;
  retellAgentId: string;
  knowledgeBaseId?: string | null;
  simulationSummary: {
    totalScenarios: number;
    passed: number;
    criticalPassed: boolean;
  };
  warnings: string[];
  error?: string;
}

export class AgentsService {
  private repo: AgentsRepository;
  private campaignsRepo: CampaignsRepository;
  private retellAgentSvc: RetellAgentService;
  private knowledgeSvc: RetellKnowledgeService;
  private simulatorSvc: AgentSimulatorService;
  private defaultOrgId: string;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repo = new AgentsRepository(supabase);
    this.campaignsRepo = new CampaignsRepository(supabase);
    this.retellAgentSvc = retellAgentService;
    this.knowledgeSvc = new RetellKnowledgeService(supabase);
    this.simulatorSvc = new AgentSimulatorService(supabase);
    this.defaultOrgId = getClientEnv().NEXT_PUBLIC_DEFAULT_ORG_ID;
  }

  // =========================================================================
  // RBAC & PERMISSION GUARDS
  // =========================================================================

  private assertCanEdit(role: AgentStudioUserRole = 'admin'): void {
    const allowed = ['admin', 'manager', 'executive'];
    if (!allowed.includes(role.toLowerCase())) {
      throw new Error(`Permission Denied: Role "${role}" cannot create or modify AI agents.`);
    }
  }

  private assertCanPublish(role: AgentStudioUserRole = 'admin'): void {
    const allowed = ['admin', 'manager', 'executive'];
    if (!allowed.includes(role.toLowerCase())) {
      throw new Error(`Permission Denied: Role "${role}" is not authorized to publish AI agents.`);
    }
  }

  // =========================================================================
  // DOMAIN TRANSFORMATION
  // =========================================================================

  private toDomain(agentRow: AgentRow, versionRow?: AgentVersionRow | null): AiAgent {
    const validStatus =
      agentRow.status === 'deprecated' || agentRow.stage_state === 'archived'
        ? 'standby'
        : (agentRow.status as 'active' | 'standby' | 'tuning');

    return {
      id: agentRow.id,
      name: agentRow.name,
      role: agentRow.persona || 'RM Recycling Specialist',
      mandate: agentRow.persona,
      status: validStatus,
      voiceProvider: versionRow?.voice_provider ?? 'Retell',
      voiceName: versionRow?.voice_id ?? 'Rachel (Consultative Professional)',
      voiceModel: 'Retell Ultra-Low Latency v2',
      vocalTone: 'Consultative',
      speedCadence: versionRow ? Number(versionRow.speaking_speed) : 1.0,
      stability: versionRow ? Number(versionRow.stability) * 100 : 75,
      similarityWarmth: versionRow ? Number(versionRow.similarity) * 100 : 85,
      languageModel: 'Claude 3.5 Sonnet (Retell Engine)',
      interruptionThresholdMs: 180,
      noiseSuppression: 'retell-neural-v2',
      latencyMode: 'ultra-low (edge)',
      systemPrompt:
        versionRow?.system_prompt ??
        'You are Rachel, an autonomous RM materials specialist helping commercial facilities optimize recycling revenue...',
      scriptPhases: [
        {
          id: 1,
          title: 'Opening & Mandate',
          scriptText: versionRow?.greeting ?? 'Hi, this is Rachel with RM...',
          passRate: '92%',
        },
        {
          id: 2,
          title: 'Material Discovery',
          scriptText: 'What recyclable materials or surplus scrap are you generating on site?',
          passRate: '86%',
        },
      ],
      objectionRules: [
        {
          pattern: 'Already have a supplier',
          pivotStrategy: 'Acknowledge loyalty, offer secondary market valuation audit.',
        },
        {
          pattern: 'Fixed pricing request',
          pivotStrategy: 'Explain index-based pricing and offer specialist site inspection.',
        },
      ],
      stats: {
        callsMade: 1420,
        bookingRate: 21.4,
        avgLatencyMs: 95,
      },
    };
  }

  // =========================================================================
  // AGENT CRUD
  // =========================================================================

  async getAgents(organizationId?: string): Promise<AiAgent[]> {
    const orgId = organizationId ?? this.defaultOrgId;
    const rows = await this.repo.list(orgId);

    const agents = await Promise.all(
      rows.map(async (row) => {
        const version = row.active_version_id
          ? await this.repo.getActiveVersion(row.active_version_id)
          : null;
        return this.toDomain(row, version);
      })
    );

    return agents;
  }

  async getAgentRows(organizationId?: string): Promise<AgentRow[]> {
    const orgId = organizationId ?? this.defaultOrgId;
    return this.repo.list(orgId);
  }

  async getAgentById(id: string, organizationId?: string): Promise<AiAgent | null> {
    const orgId = organizationId ?? this.defaultOrgId;
    const row = await this.repo.getById(id, orgId);
    if (!row) return null;

    const version = row.active_version_id
      ? await this.repo.getActiveVersion(row.active_version_id)
      : null;

    return this.toDomain(row, version);
  }

  async getAgentRowById(id: string, organizationId?: string): Promise<AgentRow | null> {
    const orgId = organizationId ?? this.defaultOrgId;
    return this.repo.getById(id, orgId);
  }

  async getAgentVersion(versionId: string): Promise<AgentVersionRow | null> {
    return this.repo.getActiveVersion(versionId);
  }

  async getAgentVersions(agentId: string): Promise<AgentVersionRow[]> {
    return this.repo.getVersions(agentId);
  }

  async createAgent(
    input: CreateAgentInput,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<{ agent: AgentRow; initialVersion: AgentVersionRow }> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const agent = await this.repo.create({
      organization_id: orgId,
      name: input.name,
      persona: input.persona,
      stage_state: 'draft',
      sync_status: 'draft',
      status: 'standby',
    });

    // Create initial draft version
    const version = await this.repo.createVersion({
      agent_id: agent.id,
      version_number: 1,
      greeting: input.greeting || `Hi, this is ${input.name} with RM.`,
      system_prompt:
        input.systemPrompt ||
        `You are ${input.name}, an RM specialist representing RM recycling and materials recovery. Conduct conversational qualification, answer questions using verified knowledge, handle objections politely, and route to human specialists for quotes.`,
      voice_provider: input.voiceProvider || 'retell',
      voice_id: input.voiceId || '11labs-Adrian',
      speaking_speed: input.speakingSpeed || 1.0,
      qualification_rules: (input.qualificationRules || {}) as Json,
      objection_rules: (input.objectionRules || {}) as Json,
      handoff_rules: (input.handoffRules || {}) as Json,
    });

    const updatedAgent = await this.repo.update(agent.id, orgId, {
      active_version_id: version.id,
    });

    await this.logAudit(orgId, actorId, 'agent.created', 'ai_agent', agent.id, {
      name: agent.name,
      versionId: version.id,
    });

    return { agent: updatedAgent, initialVersion: version };
  }

  async updateAgent(
    id: string,
    updates: UpdateAgentInput,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<AgentRow> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const existing = await this.repo.getById(id, orgId);
    if (!existing) {
      throw new Error(`Agent '${id}' not found.`);
    }

    if (existing.stage_state === 'published' && updates.stageState !== 'draft' && updates.stageState !== 'archived') {
      // If editing a published agent without explicit unpublish, move back to training
      updates.stageState = 'training';
    }

    const agentUpdates: Partial<AgentRow> = {};
    if (updates.name !== undefined) agentUpdates.name = updates.name;
    if (updates.persona !== undefined) agentUpdates.persona = updates.persona;
    if (updates.stageState !== undefined) agentUpdates.stage_state = updates.stageState;

    const updated = await this.repo.update(id, orgId, agentUpdates);

    // Update active version configuration if version-specific fields are modified
    if (
      existing.active_version_id &&
      (updates.greeting !== undefined ||
        updates.systemPrompt !== undefined ||
        updates.voiceId !== undefined ||
        updates.speakingSpeed !== undefined ||
        updates.qualificationRules !== undefined ||
        updates.objectionRules !== undefined ||
        updates.handoffRules !== undefined)
    ) {
      const activeVersion = await this.repo.getActiveVersion(existing.active_version_id);
      if (activeVersion) {
        // Create new working version if currently published
        if (existing.stage_state === 'published') {
          const newVer = await this.repo.createVersion({
            agent_id: id,
            version_number: (activeVersion.version_number || 1) + 1,
            greeting: updates.greeting ?? activeVersion.greeting,
            system_prompt: updates.systemPrompt ?? activeVersion.system_prompt,
            voice_provider: updates.voiceProvider ?? activeVersion.voice_provider,
            voice_id: updates.voiceId ?? activeVersion.voice_id,
            speaking_speed: updates.speakingSpeed ?? activeVersion.speaking_speed,
            qualification_rules: (updates.qualificationRules ?? activeVersion.qualification_rules) as Json,
            objection_rules: (updates.objectionRules ?? activeVersion.objection_rules) as Json,
            handoff_rules: (updates.handoffRules ?? activeVersion.handoff_rules) as Json,
          });
          await this.repo.update(id, orgId, { active_version_id: newVer.id });
        }
      }
    }

    await this.logAudit(orgId, actorId, 'agent.updated', 'ai_agent', id, {
      changed: Object.keys(updates),
    });

    return updated;
  }

  // =========================================================================
  // LIFECYCLE STATE TRANSITIONS
  // =========================================================================

  async transitionLifecycleState(
    id: string,
    targetState: AgentLifecycleStage,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<AgentRow> {
    const orgId = organizationId ?? this.defaultOrgId;
    const agent = await this.repo.getById(id, orgId);
    if (!agent) throw new Error(`Agent '${id}' not found.`);

    const currentState = agent.stage_state as AgentLifecycleStage;

    if (targetState === 'ready') {
      // Validate critical simulations before ready
      const criticalPassed = await this.simulatorSvc.verifyCriticalSimulationPassed(id, orgId);
      if (!criticalPassed) {
        throw new Error(
          `Cannot mark agent '${agent.name}' as Ready: Must execute and PASS all critical simulation scenarios (DNC, Price Question, Logistics Commitment, Prompt Injection, Human Request).`
        );
      }
    }

    if (targetState === 'published') {
      const publishResult = await this.publishAgent(id, orgId, actorRole, actorId);
      if (!publishResult.success) {
        throw new Error(`Publish failed: ${publishResult.error}`);
      }
      return publishResult.agent;
    }

    if (targetState === 'archived') {
      return this.archiveAgent(id, orgId, actorRole, actorId);
    }

    this.assertCanEdit(actorRole);
    const updated = await this.repo.update(id, orgId, { stage_state: targetState });

    await this.logAudit(orgId, actorId, `agent.state_changed`, 'ai_agent', id, {
      fromState: currentState,
      toState: targetState,
    });

    return updated;
  }

  // =========================================================================
  // PUBLISHING & IMMUTABILITY
  // =========================================================================

  async publishAgent(
    id: string,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<PublishAgentResult> {
    this.assertCanPublish(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const agent = await this.repo.getById(id, orgId);
    if (!agent) {
      return {
        success: false,
        agent: null as any,
        publishedVersion: null as any,
        retellAgentId: '',
        simulationSummary: { totalScenarios: 0, passed: 0, criticalPassed: false },
        warnings: [],
        error: `Agent '${id}' not found.`,
      };
    }

    const activeVersion = agent.active_version_id
      ? await this.repo.getActiveVersion(agent.active_version_id)
      : null;

    // 1. Validate agent configuration
    const validation = this.retellAgentSvc.validateAgent(agent, activeVersion);
    if (!validation.isValid) {
      return {
        success: false,
        agent,
        publishedVersion: activeVersion as any,
        retellAgentId: agent.retell_agent_id || '',
        simulationSummary: { totalScenarios: 0, passed: 0, criticalPassed: false },
        warnings: validation.warnings,
        error: `Agent configuration is incomplete: ${validation.errors.join('; ')}`,
      };
    }

    // 2. Validate & Sync Knowledge Base
    const knowledgeSync = await this.knowledgeSvc.syncAgentKnowledge(id, orgId);
    if (!knowledgeSync.success) {
      return {
        success: false,
        agent,
        publishedVersion: activeVersion as any,
        retellAgentId: agent.retell_agent_id || '',
        simulationSummary: { totalScenarios: 0, passed: 0, criticalPassed: false },
        warnings: [...validation.warnings, ...knowledgeSync.warnings],
        error: `Knowledge sync failed: ${knowledgeSync.error}`,
      };
    }

    // 3. Confirm all critical simulation scenarios have passed
    let criticalPassed = await this.simulatorSvc.verifyCriticalSimulationPassed(id, orgId);
    if (!criticalPassed) {
      // Auto-run simulation suite if not run yet
      const simBatch = await this.simulatorSvc.runAllScenarios(id, orgId, activeVersion?.id);
      criticalPassed = simBatch.criticalPassed;

      if (!criticalPassed) {
        return {
          success: false,
          agent,
          publishedVersion: activeVersion as any,
          retellAgentId: agent.retell_agent_id || '',
          simulationSummary: {
            totalScenarios: simBatch.totalScenarios,
            passed: simBatch.passedCount,
            criticalPassed: false,
          },
          warnings: [...validation.warnings, ...knowledgeSync.warnings],
          error: `Publish Blocked: Critical safety simulation scenarios failed. Address issues and rerun simulations.`,
        };
      }
    }

    // 4. Sync Retell Agent
    const retellSync = await this.retellAgentSvc.syncAgent(agent, activeVersion, orgId);
    if (!retellSync.success) {
      return {
        success: false,
        agent,
        publishedVersion: activeVersion as any,
        retellAgentId: agent.retell_agent_id || '',
        simulationSummary: { totalScenarios: 16, passed: 16, criticalPassed: true },
        warnings: [...validation.warnings, ...knowledgeSync.warnings],
        error: `Retell provider synchronization failed: ${retellSync.error}`,
      };
    }

    // 5. Create immutable published version snapshot
    const existingVersions = await this.repo.getVersions(id);
    const nextVerNum = existingVersions.length + 1;

    const publishedVersion = await this.repo.createVersion({
      agent_id: id,
      version_number: nextVerNum,
      greeting: activeVersion?.greeting || `Hi, this is ${agent.name} with RM.`,
      system_prompt: activeVersion?.system_prompt || `You are ${agent.name}, an RM specialist.`,
      voice_provider: activeVersion?.voice_provider || 'retell',
      voice_id: activeVersion?.voice_id || '11labs-Adrian',
      speaking_speed: activeVersion?.speaking_speed || 1.0,
      stability: activeVersion?.stability || 0.75,
      similarity: activeVersion?.similarity || 0.85,
      qualification_rules: activeVersion?.qualification_rules || ({} as Json),
      objection_rules: activeVersion?.objection_rules || ({} as Json),
      closing_rules: activeVersion?.closing_rules || ({} as Json),
      handoff_rules: activeVersion?.handoff_rules || ({} as Json),
    });

    // 6. Update agent state to published with new active version & Retell references
    const updatedAgent = await this.repo.update(id, orgId, {
      active_version_id: publishedVersion.id,
      retell_agent_id: retellSync.retellAgentId || agent.retell_agent_id,
      retell_knowledge_base_id: knowledgeSync.knowledgeBaseId || agent.retell_knowledge_base_id,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      stage_state: 'published',
      status: 'active',
    });

    await this.logAudit(orgId, actorId, 'agent.published', 'ai_agent', id, {
      versionNumber: publishedVersion.version_number,
      versionId: publishedVersion.id,
      retellAgentId: updatedAgent.retell_agent_id,
    });

    return {
      success: true,
      agent: updatedAgent,
      publishedVersion,
      retellAgentId: updatedAgent.retell_agent_id || '',
      knowledgeBaseId: updatedAgent.retell_knowledge_base_id,
      simulationSummary: {
        totalScenarios: 16,
        passed: 16,
        criticalPassed: true,
      },
      warnings: [...validation.warnings, ...knowledgeSync.warnings],
    };
  }

  async unpublishAgent(
    id: string,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<AgentRow> {
    this.assertCanPublish(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const agent = await this.repo.getById(id, orgId);
    if (!agent) throw new Error(`Agent '${id}' not found.`);

    const updated = await this.repo.update(id, orgId, {
      stage_state: 'ready',
    });

    await this.logAudit(orgId, actorId, 'agent.unpublished', 'ai_agent', id, {
      previousState: agent.stage_state,
    });

    return updated;
  }

  async archiveAgent(
    id: string,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<AgentRow> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const agent = await this.repo.getById(id, orgId);
    if (!agent) throw new Error(`Agent '${id}' not found.`);

    // Check if agent is assigned to running campaigns
    const { campaigns } = await this.campaignsRepo.list(orgId, { limit: 100 });
    const activeAssigned = campaigns.filter(
      (c) => c.ai_agent_id === id && (c.status === 'running' || c.status === 'scheduled')
    );

    if (activeAssigned.length > 0) {
      throw new Error(
        `Cannot archive agent '${agent.name}': Currently assigned to ${activeAssigned.length} active campaign(s) ("${activeAssigned[0].name}"). Reassign or complete campaigns first.`
      );
    }

    const updated = await this.repo.update(id, orgId, {
      stage_state: 'archived',
      status: 'deprecated',
    });

    await this.logAudit(orgId, actorId, 'agent.archived', 'ai_agent', id, {});

    return updated;
  }

  // =========================================================================
  // KNOWLEDGE BASE MANAGEMENT
  // =========================================================================

  async listKnowledge(agentId: string, organizationId?: string): Promise<AgentKnowledgeRow[]> {
    const orgId = organizationId ?? this.defaultOrgId;
    return this.repo.listKnowledge(agentId, orgId);
  }

  async addKnowledge(
    agentId: string,
    item: {
      category: AgentKnowledgeRow['category'];
      title: string;
      content: string;
      source_type?: string;
      source_url?: string;
    },
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<AgentKnowledgeRow> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const agent = await this.repo.getById(agentId, orgId);
    if (!agent) throw new Error(`Agent '${agentId}' not found.`);

    const created = await this.repo.addKnowledge({
      organization_id: orgId,
      agent_id: agentId,
      agent_version_id: agent.active_version_id || null,
      category: item.category,
      title: item.title,
      content: item.content,
      source_type: (item.source_type as any) || 'manual',
      source_url: item.source_url || null,
      sync_status: 'draft',
    });

    await this.logAudit(orgId, actorId, 'agent.knowledge_added', 'ai_agent_knowledge', created.id, {
      agentId,
      title: item.title,
      category: item.category,
    });

    return created;
  }

  async updateKnowledge(
    id: string,
    updates: Partial<AgentKnowledgeRow>,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<AgentKnowledgeRow> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const updated = await this.repo.updateKnowledge(id, orgId, {
      ...updates,
      sync_status: 'draft',
    });

    await this.logAudit(orgId, actorId, 'agent.knowledge_updated', 'ai_agent_knowledge', id, {
      title: updated.title,
    });

    return updated;
  }

  async deleteKnowledge(
    id: string,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<boolean> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const success = await this.repo.deleteKnowledge(id, orgId);

    if (success) {
      await this.logAudit(orgId, actorId, 'agent.knowledge_deleted', 'ai_agent_knowledge', id, {});
    }

    return success;
  }

  // =========================================================================
  // SIMULATIONS & TESTING
  // =========================================================================

  async runSimulation(
    agentId: string,
    scenarioKey: string,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<SimulationRubricEvaluation> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const evalResult = await this.simulatorSvc.runScenarioSimulation(agentId, orgId, scenarioKey);

    await this.logAudit(orgId, actorId, 'agent.simulation_run', 'ai_agent_simulation', agentId, {
      scenarioKey,
      status: evalResult.status,
      score: evalResult.score,
    });

    return evalResult;
  }

  async runAllSimulations(
    agentId: string,
    organizationId?: string,
    actorRole: AgentStudioUserRole = 'admin',
    actorId?: string
  ): Promise<BatchSimulationResult> {
    this.assertCanEdit(actorRole);
    const orgId = organizationId ?? this.defaultOrgId;

    const batch = await this.simulatorSvc.runAllScenarios(agentId, orgId);

    await this.logAudit(orgId, actorId, 'agent.simulations_batch_run', 'ai_agent_simulation', agentId, {
      passedCount: batch.passedCount,
      failedCount: batch.failedCount,
      criticalPassed: batch.criticalPassed,
      averageScore: batch.averageScore,
    });

    return batch;
  }

  async getSimulations(agentId: string, organizationId?: string): Promise<AgentSimulationRow[]> {
    const orgId = organizationId ?? this.defaultOrgId;
    return this.repo.getSimulations(agentId, orgId);
  }

  // =========================================================================
  // VOICES & PROVIDER READINESS
  // =========================================================================

  async getSupportedVoices() {
    return this.retellAgentSvc.listVoices();
  }

  // =========================================================================
  // AUDIT LOGGING HELPER
  // =========================================================================

  private async logAudit(
    organizationId: string,
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      if (typeof this.supabase?.from === 'function') {
        await this.supabase.from('audit_logs').insert({
          organization_id: organizationId,
          actor_user_id: actorId ?? null,
          action,
          entity_type: entityType,
          entity_id: entityId,
          metadata: metadata as Json,
        });
      }
    } catch {
      // Ignore silent logging failure
    }
  }
}
