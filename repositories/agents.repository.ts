import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type AgentRow = Database['public']['Tables']['ai_agents']['Row'];
export type AgentInsert = Database['public']['Tables']['ai_agents']['Insert'];
export type AgentUpdate = Database['public']['Tables']['ai_agents']['Update'];

export type AgentVersionRow = Database['public']['Tables']['ai_agent_versions']['Row'];
export type AgentVersionInsert = Database['public']['Tables']['ai_agent_versions']['Insert'];
export type AgentVersionUpdate = Database['public']['Tables']['ai_agent_versions']['Update'];

export type AgentKnowledgeRow = Database['public']['Tables']['ai_agent_knowledge']['Row'];
export type AgentKnowledgeInsert = Database['public']['Tables']['ai_agent_knowledge']['Insert'];
export type AgentKnowledgeUpdate = Database['public']['Tables']['ai_agent_knowledge']['Update'];

export type AgentSimulationRow = Database['public']['Tables']['ai_agent_simulations']['Row'];
export type AgentSimulationInsert = Database['public']['Tables']['ai_agent_simulations']['Insert'];

export class AgentsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  private enrichAgentRow(row: any): AgentRow {
    if (!row) return row;
    if (!row.stage_state) {
      row.stage_state = row.status === 'ready' || row.status === 'published' ? 'published' : (row.status || 'draft');
    }
    return row as AgentRow;
  }

  async list(orgId: string): Promise<AgentRow[]> {
    const { data, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data as any[]) ?? []).map((r) => this.enrichAgentRow(r));
  }

  async getById(id: string, orgId?: string): Promise<AgentRow | null> {
    if (!id || typeof id !== 'string') return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = this.supabase.from('ai_agents').select('*');
    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('retell_agent_id', id);
    }
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      return this.enrichAgentRow(data);
    }

    // Fallback for logical agent aliases ('ag_rachel', 'ag_marcus', 'ag_elena') or configured RETELL_AGENT_ID
    const envRetellId = process.env.RETELL_AGENT_ID || 'agent_25a6c8f0015fbdc154a572e2a8';
    const isDefaultAlias =
      id === 'ag_rachel' ||
      id === 'ag_marcus' ||
      id === 'ag_elena' ||
      id === envRetellId ||
      id.startsWith('agent_');

    if (isDefaultAlias && orgId) {
      try {
        const { data: orgAgents } = await this.supabase
          .from('ai_agents')
          .select('*')
          .eq('organization_id', orgId)
          .eq('status', 'ready' as any)
          .order('created_at', { ascending: false })
          .limit(1);

        if (orgAgents && orgAgents.length > 0) {
          return this.enrichAgentRow(orgAgents[0]);
        }
      } catch {
        // Fallback below if table query fails in mock/test environments
      }
    }

    return null;
  }

  async create(input: AgentInsert): Promise<AgentRow> {
    const { data, error } = await this.supabase
      .from('ai_agents')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return this.enrichAgentRow(data);
  }

  async update(id: string, orgId: string, input: AgentUpdate): Promise<AgentRow> {
    const { data, error } = await this.supabase
      .from('ai_agents')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();
    if (error) throw error;
    return this.enrichAgentRow(data);
  }

  async getActiveVersion(
    versionId: string | null | undefined
  ): Promise<AgentVersionRow | null> {
    if (!versionId) return null;
    const { data, error } = await this.supabase
      .from('ai_agent_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();
    if (error) throw error;
    return (data as AgentVersionRow | null) ?? null;
  }

  async getVersions(agentId: string): Promise<AgentVersionRow[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_versions')
      .select('*')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return (data as AgentVersionRow[]) ?? [];
  }

  async createVersion(input: AgentVersionInsert): Promise<AgentVersionRow> {
    const { data, error } = await this.supabase
      .from('ai_agent_versions')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as AgentVersionRow;
  }

  async listKnowledge(
    agentId: string,
    orgId?: string
  ): Promise<AgentKnowledgeRow[]> {
    let query = this.supabase
      .from('ai_agent_knowledge')
      .select('*')
      .eq('agent_id', agentId);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return (data as AgentKnowledgeRow[]) ?? [];
  }

  async addKnowledge(input: AgentKnowledgeInsert): Promise<AgentKnowledgeRow> {
    const { data, error } = await this.supabase
      .from('ai_agent_knowledge')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as AgentKnowledgeRow;
  }

  async updateKnowledge(
    id: string,
    orgId: string,
    input: AgentKnowledgeUpdate
  ): Promise<AgentKnowledgeRow> {
    const { data, error } = await this.supabase
      .from('ai_agent_knowledge')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();
    if (error) throw error;
    return data as AgentKnowledgeRow;
  }

  async deleteKnowledge(id: string, orgId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('ai_agent_knowledge')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);
    if (error) throw error;
    return true;
  }

  async getSimulations(
    agentId: string,
    orgId?: string,
    limit: number = 20
  ): Promise<AgentSimulationRow[]> {
    let query = this.supabase
      .from('ai_agent_simulations')
      .select('*')
      .eq('agent_id', agentId);
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data as AgentSimulationRow[]) ?? [];
  }

  async recordSimulation(
    input: AgentSimulationInsert
  ): Promise<AgentSimulationRow> {
    const { data, error } = await this.supabase
      .from('ai_agent_simulations')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as AgentSimulationRow;
  }
}

