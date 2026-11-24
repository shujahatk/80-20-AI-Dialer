export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'admin' | 'manager' | 'agent';
export type UserRole = AppRole | 'operator' | 'viewer';
export type UserStatus = 'active' | 'invited' | 'disabled';
export type LeadStatusDb =
  | 'NEW'
  | 'CONTACTED'
  | 'ENGAGED'
  | 'TECHNICAL_EVALUATION'
  | 'COMMERCIAL_DISCUSSION'
  | 'new'
  | 'queued'
  | 'in_progress'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'unqualified'
  | 'dnc'
  | 'confirmed'
  | 'interested'
  | 'follow_up'
  | 'callback'
  | 'not_interested'
  | 'do_not_call';
export type LeadPriorityDb = 'urgent' | 'high' | 'medium' | 'low';
export type LeadTemperatureDb = 'HOT' | 'WARM' | 'COLD';
export type CampaignStatusDb = 'draft' | 'ready' | 'paused' | 'archived' | 'scheduled' | 'running' | 'completed' | 'cancelled';
export type AgentStatusDb = 'draft' | 'ready' | 'archived' | 'training' | 'testing' | 'published';
export type ImportStatusDb = 'processing' | 'completed' | 'failed' | 'pending';
export type CallStatusDb = 'registered' | 'queued' | 'ringing' | 'in_progress' | 'completed' | 'busy' | 'no_answer' | 'failed' | 'cancelled';
export type CallDirectionDb = 'outbound' | 'inbound';
export type CallbackStatusDb = 'pending' | 'completed' | 'missed' | 'cancelled';
export type AppointmentStatusDb = 'scheduled' | 'held' | 'rescheduled' | 'no_show' | 'cancelled';
export type ProviderStatusDb = 'connected' | 'disconnected' | 'degraded' | 'testing';
export type WebhookStatusDb = 'received' | 'processed' | 'failed' | 'ignored';

export interface Database {
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          key: string;
          count: number;
          reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          count?: number;
          reset_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          count?: number;
          reset_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          display_name: string;
          avatar_url: string | null;
          role: UserRole;
          status: UserStatus;
          timezone: string;
          created_at: string;
          updated_at: string;
          last_seen_at: string | null;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          display_name: string;
          avatar_url?: string | null;
          role?: UserRole;
          status?: UserStatus;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          status?: UserStatus;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string | null;
        };
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: AppRole;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: AppRole;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      organization_settings: {
        Row: {
          id: string;
          organization_id: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: AppRole;
          status: string;
          invited_by: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: AppRole;
          status?: string;
          invited_by?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: AppRole;
          status?: string;
          invited_by?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: string;
          role: AppRole;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          role: AppRole;
          permission_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: AppRole;
          permission_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          company: string;
          title: string;
          phone: string;
          email: string | null;
          city: string;
          status: LeadStatusDb;
          temperature: LeadTemperatureDb;
          do_not_call: boolean;
          deleted_at: string | null;
          assigned_to?: string | null;
          created_by: string | null;
          score?: number | null;
          deal_value?: number | null;
          product?: string | null;
          next_action?: string | null;
          notes?: string | null;
          consent_at?: string | null;
          metadata?: Json;
          created_at: string;
          updated_at: string;
          // Compatibility aliases
          first_name?: string;
          last_name?: string;
          full_name?: string;
          company_name?: string;
          job_title?: string;
          phone_e164?: string;
          country?: string;
          region?: string;
          timezone?: string;
          source?: string;
          priority?: LeadPriorityDb;
          is_dnc?: boolean;
          dnc_reason?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
          last_contacted_at?: string | null;
          next_contact_at?: string | null;
          custom_fields?: Json;
          stop_all_contact?: boolean;
          email_unsubscribed_at?: string | null;
          email_opt_in?: boolean;
          email_lawful_basis?: string | null;
          email_lawful_basis_evidence?: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name?: string;
          company?: string;
          title?: string;
          phone: string;
          email?: string | null;
          city?: string;
          status?: LeadStatusDb;
          temperature?: LeadTemperatureDb;
          do_not_call?: boolean;
          deleted_at?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          score?: number | null;
          deal_value?: number | null;
          product?: string | null;
          next_action?: string | null;
          notes?: string | null;
          consent_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          // Compatibility aliases
          first_name?: string;
          last_name?: string;
          full_name?: string;
          company_name?: string;
          job_title?: string;
          phone_e164?: string;
          country?: string;
          region?: string;
          timezone?: string;
          source?: string;
          priority?: LeadPriorityDb;
          is_dnc?: boolean;
          dnc_reason?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
          last_contacted_at?: string | null;
          next_contact_at?: string | null;
          custom_fields?: Json;
          stop_all_contact?: boolean;
          email_unsubscribed_at?: string | null;
          email_opt_in?: boolean;
          email_lawful_basis?: string | null;
          email_lawful_basis_evidence?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          company?: string;
          title?: string;
          phone?: string;
          email?: string | null;
          city?: string;
          status?: LeadStatusDb;
          temperature?: LeadTemperatureDb;
          do_not_call?: boolean;
          deleted_at?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          score?: number | null;
          deal_value?: number | null;
          product?: string | null;
          next_action?: string | null;
          notes?: string | null;
          consent_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          // Compatibility aliases
          first_name?: string;
          last_name?: string;
          full_name?: string;
          company_name?: string;
          job_title?: string;
          phone_e164?: string;
          country?: string;
          region?: string;
          timezone?: string;
          source?: string;
          priority?: LeadPriorityDb;
          is_dnc?: boolean;
          dnc_reason?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
          last_contacted_at?: string | null;
          next_contact_at?: string | null;
          custom_fields?: Json;
          stop_all_contact?: boolean;
          email_unsubscribed_at?: string | null;
          email_opt_in?: boolean;
          email_lawful_basis?: string | null;
          email_lawful_basis_evidence?: string | null;
        };
        Relationships: [];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          author_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          author_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_tags: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          color: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          color?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          color?: string;
        };
        Relationships: [];
      };
      lead_tag_assignments: {
        Row: {
          lead_id: string;
          tag_id: string;
        };
        Insert: {
          lead_id: string;
          tag_id: string;
        };
        Update: {
          lead_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      ai_agents: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          persona: string;
          active_version_id: string | null;
          status: string;
          retell_agent_id: string | null;
          retell_llm_id: string | null;
          retell_knowledge_base_id: string | null;
          sync_status: 'draft' | 'syncing' | 'synced' | 'failed' | 'stale';
          last_synced_at: string | null;
          stage_state: 'draft' | 'training' | 'testing' | 'ready' | 'published' | 'archived';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          persona: string;
          active_version_id?: string | null;
          status?: string;
          retell_agent_id?: string | null;
          retell_llm_id?: string | null;
          retell_knowledge_base_id?: string | null;
          sync_status?: 'draft' | 'syncing' | 'synced' | 'failed' | 'stale';
          last_synced_at?: string | null;
          stage_state?: 'draft' | 'training' | 'testing' | 'ready' | 'published' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          persona?: string;
          active_version_id?: string | null;
          status?: string;
          retell_agent_id?: string | null;
          retell_llm_id?: string | null;
          retell_knowledge_base_id?: string | null;
          sync_status?: 'draft' | 'syncing' | 'synced' | 'failed' | 'stale';
          last_synced_at?: string | null;
          stage_state?: 'draft' | 'training' | 'testing' | 'ready' | 'published' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_agent_versions: {
        Row: {
          id: string;
          agent_id: string;
          version_number: number;
          system_prompt: string;
          greeting: string;
          voice_provider: string;
          voice_id: string;
          speaking_speed: number;
          stability: number;
          similarity: number;
          qualification_rules: Json;
          objection_rules: Json;
          closing_rules: Json;
          handoff_rules: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          version_number?: number;
          system_prompt: string;
          greeting: string;
          voice_provider?: string;
          voice_id: string;
          speaking_speed?: number;
          stability?: number;
          similarity?: number;
          qualification_rules?: Json;
          objection_rules?: Json;
          closing_rules?: Json;
          handoff_rules?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          version_number?: number;
          system_prompt?: string;
          greeting?: string;
          voice_provider?: string;
          voice_id?: string;
          speaking_speed?: number;
          stability?: number;
          similarity?: number;
          qualification_rules?: Json;
          objection_rules?: Json;
          closing_rules?: Json;
          handoff_rules?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description?: string;
          status: CampaignStatusDb;
          ai_agent_id?: string | null;
          agent_id?: string | null;
          schedule_window?: string;
          retry_policy?: string;
          timezone?: string;
          start_date?: string | null;
          end_date?: string | null;
          calling_window_start?: string;
          calling_window_end?: string;
          max_attempts_per_lead?: number;
          retry_delay_minutes?: number;
          concurrency_limit?: number;
          daily_attempt_limit?: number;
          calling_days?: number[];
          email_followup_enabled?: boolean;
          email_lawful_basis?: string | null;
          email_lawful_basis_note?: string | null;
          email_instructions?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string;
          status?: CampaignStatusDb;
          ai_agent_id?: string | null;
          agent_id?: string | null;
          schedule_window?: string;
          retry_policy?: string;
          timezone?: string;
          start_date?: string | null;
          end_date?: string | null;
          calling_window_start?: string;
          calling_window_end?: string;
          max_attempts_per_lead?: number;
          retry_delay_minutes?: number;
          concurrency_limit?: number;
          daily_attempt_limit?: number;
          calling_days?: number[];
          email_followup_enabled?: boolean;
          email_lawful_basis?: string | null;
          email_lawful_basis_note?: string | null;
          email_instructions?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string;
          status?: CampaignStatusDb;
          ai_agent_id?: string | null;
          agent_id?: string | null;
          schedule_window?: string;
          retry_policy?: string;
          timezone?: string;
          start_date?: string | null;
          end_date?: string | null;
          calling_window_start?: string;
          calling_window_end?: string;
          max_attempts_per_lead?: number;
          retry_delay_minutes?: number;
          concurrency_limit?: number;
          daily_attempt_limit?: number;
          calling_days?: number[];
          email_followup_enabled?: boolean;
          email_lawful_basis?: string | null;
          email_lawful_basis_note?: string | null;
          email_instructions?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_enrollments: {
        Row: {
          id: string;
          organization_id?: string;
          campaign_id: string;
          lead_id: string;
          enrolled_by?: string | null;
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          state?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          claim_expires_at?: string | null;
          outcome?: string | null;
          last_call_id?: string | null;
          final_disposition_id?: string | null;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          campaign_id: string;
          lead_id: string;
          enrolled_by?: string | null;
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          state?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          claim_expires_at?: string | null;
          outcome?: string | null;
          last_call_id?: string | null;
          final_disposition_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          campaign_id?: string;
          lead_id?: string;
          enrolled_by?: string | null;
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          state?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          claim_expires_at?: string | null;
          outcome?: string | null;
          last_call_id?: string | null;
          final_disposition_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_leads: {
        Row: {
          id: string;
          campaign_id: string;
          lead_id: string;
          attempt_count: number;
          last_attempt_at: string | null;
          next_attempt_at: string | null;
          state: string;
          claimed_at: string | null;
          claimed_by: string | null;
          claim_expires_at: string | null;
          outcome: string | null;
          last_call_id: string | null;
          final_disposition_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          lead_id: string;
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          state?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          claim_expires_at?: string | null;
          outcome?: string | null;
          last_call_id?: string | null;
          final_disposition_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          lead_id?: string;
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          state?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          claim_expires_at?: string | null;
          outcome?: string | null;
          last_call_id?: string | null;
          final_disposition_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      call_sessions: {
        Row: {
          id: string;
          organization_id: string;
          campaign_id: string | null;
          lead_id: string | null;
          ai_agent_id: string | null;
          agent_id?: string | null;
          operator_id: string | null;
          created_by?: string | null;
          from_number?: string | null;
          to_number?: string | null;
          idempotency_key?: string | null;
          provider: string;
          provider_call_id: string | null;
          retell_call_id: string | null;
          provider_agent_id: string | null;
          provider_metadata: Json;
          disconnection_reason: string | null;
          call_cost: number;
          direction: CallDirectionDb;
          status: CallStatusDb;
          outcome: string | null;
          approved_at?: string | null;
          started_at: string;
          ringing_at: string | null;
          answered_at: string | null;
          ended_at: string | null;
          duration_seconds: number;
          connected_seconds: number;
          recording_status: string;
          transcript_status: string;
          failure_code: string | null;
          failure_reason: string | null;
          sentiment_score: number | null;
          intent_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          campaign_id?: string | null;
          lead_id?: string | null;
          ai_agent_id?: string | null;
          agent_id?: string | null;
          operator_id?: string | null;
          created_by?: string | null;
          from_number?: string | null;
          to_number?: string | null;
          idempotency_key?: string | null;
          provider?: string;
          provider_call_id?: string | null;
          retell_call_id?: string | null;
          provider_agent_id?: string | null;
          provider_metadata?: Json;
          disconnection_reason?: string | null;
          call_cost?: number;
          direction?: CallDirectionDb;
          status?: CallStatusDb;
          outcome?: string | null;
          approved_at?: string | null;
          started_at?: string;
          ringing_at?: string | null;
          answered_at?: string | null;
          ended_at?: string | null;
          duration_seconds?: number;
          connected_seconds?: number;
          recording_status?: string;
          transcript_status?: string;
          failure_code?: string | null;
          failure_reason?: string | null;
          sentiment_score?: number | null;
          intent_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          campaign_id?: string | null;
          lead_id?: string | null;
          ai_agent_id?: string | null;
          agent_id?: string | null;
          operator_id?: string | null;
          created_by?: string | null;
          from_number?: string | null;
          to_number?: string | null;
          idempotency_key?: string | null;
          provider?: string;
          provider_call_id?: string | null;
          retell_call_id?: string | null;
          provider_agent_id?: string | null;
          provider_metadata?: Json;
          disconnection_reason?: string | null;
          call_cost?: number;
          direction?: CallDirectionDb;
          status?: CallStatusDb;
          outcome?: string | null;
          approved_at?: string | null;
          started_at?: string;
          ringing_at?: string | null;
          answered_at?: string | null;
          ended_at?: string | null;
          duration_seconds?: number;
          connected_seconds?: number;
          recording_status?: string;
          transcript_status?: string;
          failure_code?: string | null;
          failure_reason?: string | null;
          sentiment_score?: number | null;
          intent_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      call_approval_audits: {
        Row: {
          id: string;
          organization_id: string;
          call_session_id: string;
          approved_by: string;
          approved_at: string;
          status: 'approved' | 'rejected' | 'revoked';
          method: string;
          audit_metadata: Json;
          verification_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          call_session_id: string;
          approved_by: string;
          approved_at?: string;
          status?: 'approved' | 'rejected' | 'revoked';
          method?: string;
          audit_metadata?: Json;
          verification_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          call_session_id?: string;
          approved_by?: string;
          approved_at?: string;
          status?: 'approved' | 'rejected' | 'revoked';
          method?: string;
          audit_metadata?: Json;
          verification_hash?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      calls: {
        Row: {
          id: string;
          organization_id: string;
          campaign_id: string | null;
          lead_id: string | null;
          ai_agent_id: string | null;
          agent_id?: string | null;
          operator_id: string | null;
          created_by?: string | null;
          from_number?: string | null;
          to_number?: string | null;
          idempotency_key?: string | null;
          provider: string;
          provider_call_id: string | null;
          retell_call_id: string | null;
          provider_agent_id: string | null;
          provider_metadata: Json;
          disconnection_reason: string | null;
          call_cost: number;
          direction: CallDirectionDb;
          status: CallStatusDb;
          outcome: string | null;
          approved_at?: string | null;
          started_at: string;
          ringing_at: string | null;
          answered_at: string | null;
          ended_at: string | null;
          duration_seconds: number;
          connected_seconds: number;
          recording_status: string;
          transcript_status: string;
          failure_code: string | null;
          failure_reason: string | null;
          sentiment_score: number | null;
          intent_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          campaign_id?: string | null;
          lead_id?: string | null;
          ai_agent_id?: string | null;
          agent_id?: string | null;
          operator_id?: string | null;
          created_by?: string | null;
          from_number?: string | null;
          to_number?: string | null;
          idempotency_key?: string | null;
          provider?: string;
          provider_call_id?: string | null;
          retell_call_id?: string | null;
          provider_agent_id?: string | null;
          provider_metadata?: Json;
          disconnection_reason?: string | null;
          call_cost?: number;
          direction?: CallDirectionDb;
          status?: CallStatusDb;
          outcome?: string | null;
          approved_at?: string | null;
          started_at?: string;
          ringing_at?: string | null;
          answered_at?: string | null;
          ended_at?: string | null;
          duration_seconds?: number;
          connected_seconds?: number;
          recording_status?: string;
          transcript_status?: string;
          failure_code?: string | null;
          failure_reason?: string | null;
          sentiment_score?: number | null;
          intent_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          campaign_id?: string | null;
          lead_id?: string | null;
          ai_agent_id?: string | null;
          agent_id?: string | null;
          operator_id?: string | null;
          created_by?: string | null;
          from_number?: string | null;
          to_number?: string | null;
          idempotency_key?: string | null;
          provider?: string;
          provider_call_id?: string | null;
          retell_call_id?: string | null;
          provider_agent_id?: string | null;
          provider_metadata?: Json;
          disconnection_reason?: string | null;
          call_cost?: number;
          direction?: CallDirectionDb;
          status?: CallStatusDb;
          outcome?: string | null;
          approved_at?: string | null;
          started_at?: string;
          ringing_at?: string | null;
          answered_at?: string | null;
          ended_at?: string | null;
          duration_seconds?: number;
          connected_seconds?: number;
          recording_status?: string;
          transcript_status?: string;
          failure_code?: string | null;
          failure_reason?: string | null;
          sentiment_score?: number | null;
          intent_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_agent_simulations: {
        Row: {
          id: string;
          organization_id: string;
          agent_id: string;
          agent_version_id: string | null;
          scenario_key: string;
          scenario_name: string;
          status: 'running' | 'passed' | 'failed' | 'flagged';
          transcript: Json;
          evaluation: Json;
          score: number;
          latency_ms: number;
          executed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          agent_id: string;
          agent_version_id?: string | null;
          scenario_key: string;
          scenario_name: string;
          status: 'running' | 'passed' | 'failed' | 'flagged';
          transcript?: Json;
          evaluation?: Json;
          score?: number;
          latency_ms?: number;
          executed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          agent_id?: string;
          agent_version_id?: string | null;
          scenario_key?: string;
          scenario_name?: string;
          status?: 'running' | 'passed' | 'failed' | 'flagged';
          transcript?: Json;
          evaluation?: Json;
          score?: number;
          latency_ms?: number;
          executed_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_agent_knowledge: {
        Row: {
          id: string;
          organization_id: string;
          agent_id: string;
          agent_version_id: string | null;
          category: 'Company' | 'Services' | 'Materials' | 'Industries' | 'FAQ' | 'Qualification' | 'Objections' | 'Compliance' | 'Handoff';
          title: string;
          content: string;
          source_type: 'manual' | 'faq' | 'document' | 'url';
          source_url: string | null;
          retell_knowledge_id: string | null;
          sync_status: 'draft' | 'synced' | 'failed' | 'stale';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          agent_id: string;
          agent_version_id?: string | null;
          category: 'Company' | 'Services' | 'Materials' | 'Industries' | 'FAQ' | 'Qualification' | 'Objections' | 'Compliance' | 'Handoff';
          title: string;
          content: string;
          source_type?: 'manual' | 'faq' | 'document' | 'url';
          source_url?: string | null;
          retell_knowledge_id?: string | null;
          sync_status?: 'draft' | 'synced' | 'failed' | 'stale';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          agent_id?: string;
          agent_version_id?: string | null;
          category?: 'Company' | 'Services' | 'Materials' | 'Industries' | 'FAQ' | 'Qualification' | 'Objections' | 'Compliance' | 'Handoff';
          title?: string;
          content?: string;
          source_type?: 'manual' | 'faq' | 'document' | 'url';
          source_url?: string | null;
          retell_knowledge_id?: string | null;
          sync_status?: 'draft' | 'synced' | 'failed' | 'stale';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      call_events: {
        Row: {
          id: string;
          organization_id: string;
          call_id: string;
          event_type: string;
          provider_event_id: string | null;
          payload: Json;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          call_id: string;
          event_type: string;
          provider_event_id?: string | null;
          payload?: Json;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          call_id?: string;
          event_type?: string;
          provider_event_id?: string | null;
          payload?: Json;
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      call_transcripts: {
        Row: {
          id: string;
          organization_id?: string;
          call_session_id?: string;
          body?: string;
          call_id?: string;
          speaker?: string;
          sequence_number?: number;
          text?: string;
          started_at_ms?: number;
          ended_at_ms?: number;
          confidence?: number;
          metadata?: Json;
          created_at?: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          call_session_id?: string;
          body?: string;
          call_id?: string;
          speaker?: string;
          sequence_number?: number;
          text?: string;
          started_at_ms?: number;
          ended_at_ms?: number;
          confidence?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          call_session_id?: string;
          body?: string;
          call_id?: string;
          speaker?: string;
          sequence_number?: number;
          text?: string;
          started_at_ms?: number;
          ended_at_ms?: number;
          confidence?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      call_recordings: {
        Row: {
          id: string;
          organization_id?: string;
          call_session_id?: string;
          storage_path?: string;
          external_url?: string | null;
          call_id?: string;
          provider?: string;
          provider_recording_id?: string | null;
          duration_seconds?: number;
          mime_type?: string;
          status?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          call_session_id?: string;
          storage_path?: string;
          external_url?: string | null;
          call_id?: string;
          provider?: string;
          provider_recording_id?: string | null;
          duration_seconds?: number;
          mime_type?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          call_session_id?: string;
          storage_path?: string;
          external_url?: string | null;
          call_id?: string;
          provider?: string;
          provider_recording_id?: string | null;
          duration_seconds?: number;
          mime_type?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      call_outcomes: {
        Row: {
          id: string;
          organization_id?: string | null;
          call_session_id?: string;
          disposition?: string;
          notes?: string;
          recorded_by?: string | null;
          created_at?: string;
          code?: string;
          label?: string;
          category?: string;
          is_terminal?: boolean;
          triggers_dnc?: boolean;
          triggers_callback?: boolean;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          call_session_id?: string;
          disposition?: string;
          notes?: string;
          recorded_by?: string | null;
          created_at?: string;
          code?: string;
          label?: string;
          category?: string;
          is_terminal?: boolean;
          triggers_dnc?: boolean;
          triggers_callback?: boolean;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          call_session_id?: string;
          disposition?: string;
          notes?: string;
          recorded_by?: string | null;
          created_at?: string;
          code?: string;
          label?: string;
          category?: string;
          is_terminal?: boolean;
          triggers_dnc?: boolean;
          triggers_callback?: boolean;
        };
        Relationships: [];
      };
      dispositions: {
        Row: {
          id: string;
          organization_id: string | null;
          code: string;
          label: string;
          category: string;
          is_terminal: boolean;
          triggers_dnc: boolean;
          triggers_callback: boolean;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          code: string;
          label: string;
          category: string;
          is_terminal?: boolean;
          triggers_dnc?: boolean;
          triggers_callback?: boolean;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          code?: string;
          label?: string;
          category?: string;
          is_terminal?: boolean;
          triggers_dnc?: boolean;
          triggers_callback?: boolean;
        };
        Relationships: [];
      };
      callbacks: {
        Row: {
          id: string;
          organization_id: string;
          lead_id: string;
          call_id: string | null;
          call_session_id?: string | null;
          campaign_id: string | null;
          owner_id: string | null;
          assigned_to?: string | null;
          scheduled_for: string;
          scheduled_at?: string;
          timezone: string;
          reason: string;
          notes: string | null;
          status: CallbackStatusDb;
          priority?: LeadPriorityDb;
          completed_at?: string | null;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          lead_id: string;
          call_id?: string | null;
          call_session_id?: string | null;
          campaign_id?: string | null;
          owner_id?: string | null;
          assigned_to?: string | null;
          scheduled_for: string;
          scheduled_at?: string;
          timezone?: string;
          reason?: string;
          notes?: string | null;
          status?: CallbackStatusDb;
          priority?: LeadPriorityDb;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          lead_id?: string;
          call_id?: string | null;
          call_session_id?: string | null;
          campaign_id?: string | null;
          owner_id?: string | null;
          assigned_to?: string | null;
          scheduled_for?: string;
          scheduled_at?: string;
          timezone?: string;
          reason?: string;
          notes?: string | null;
          status?: CallbackStatusDb;
          priority?: LeadPriorityDb;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          organization_id: string;
          lead_id: string;
          campaign_id: string | null;
          call_id: string | null;
          owner_id: string | null;
          scheduled_for: string;
          timezone: string;
          meeting_type: string;
          notes: string | null;
          status: AppointmentStatusDb;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          lead_id: string;
          campaign_id?: string | null;
          call_id?: string | null;
          owner_id?: string | null;
          scheduled_for: string;
          timezone?: string;
          meeting_type: string;
          notes?: string | null;
          status?: AppointmentStatusDb;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          lead_id?: string;
          campaign_id?: string | null;
          call_id?: string | null;
          owner_id?: string | null;
          scheduled_for?: string;
          timezone?: string;
          meeting_type?: string;
          notes?: string | null;
          status?: AppointmentStatusDb;
          created_at?: string;
        };
        Relationships: [];
      };
      provider_connections: {
        Row: {
          id: string;
          organization_id: string;
          provider: string;
          status: ProviderStatusDb;
          configuration: Json;
          last_tested_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          provider: string;
          status?: ProviderStatusDb;
          configuration?: Json;
          last_tested_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          provider?: string;
          status?: ProviderStatusDb;
          configuration?: Json;
          last_tested_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider?: string;
          source?: string;
          external_event_id?: string;
          external_id?: string | null;
          event_type: string;
          payload: Json;
          signature_valid?: boolean;
          processing_status?: WebhookStatusDb;
          received_at: string;
          processed_at?: string | null;
          error_message?: string | null;
          organization_id?: string | null;
        };
        Insert: {
          id?: string;
          provider?: string;
          source?: string;
          external_event_id?: string;
          external_id?: string | null;
          event_type: string;
          payload: Json;
          signature_valid?: boolean;
          processing_status?: WebhookStatusDb;
          received_at?: string;
          processed_at?: string | null;
          error_message?: string | null;
          organization_id?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          source?: string;
          external_event_id?: string;
          external_id?: string | null;
          event_type?: string;
          payload?: Json;
          signature_valid?: boolean;
          processing_status?: WebhookStatusDb;
          received_at?: string;
          processed_at?: string | null;
          error_message?: string | null;
          organization_id?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          actor_user_id?: string | null;
          action: string;
          entity?: string;
          entity_type?: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          actor_user_id?: string | null;
          action: string;
          entity?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          actor_id?: string | null;
          actor_user_id?: string | null;
          action?: string;
          entity?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      lead_import_jobs: {
        Row: {
          id: string;
          organization_id: string;
          filename: string;
          row_count?: number;
          total_rows?: number;
          inserted_count: number;
          updated_count?: number;
          skipped_count?: number;
          duplicate_count: number;
          invalid_count?: number;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          strategy?: 'skip' | 'update_missing' | 'overwrite';
          target_campaign_id?: string | null;
          column_mappings?: Json;
          error?: string | null;
          error_summary?: Json;
          created_by: string | null;
          approved_at?: string | null;
          started_at?: string;
          completed_at: string | null;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          filename: string;
          row_count?: number;
          total_rows?: number;
          inserted_count?: number;
          updated_count?: number;
          skipped_count?: number;
          duplicate_count?: number;
          invalid_count?: number;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          strategy?: 'skip' | 'update_missing' | 'overwrite';
          target_campaign_id?: string | null;
          column_mappings?: Json;
          error?: string | null;
          error_summary?: Json;
          created_by?: string | null;
          approved_at?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          filename?: string;
          row_count?: number;
          total_rows?: number;
          inserted_count?: number;
          updated_count?: number;
          skipped_count?: number;
          duplicate_count?: number;
          invalid_count?: number;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          strategy?: 'skip' | 'update_missing' | 'overwrite';
          target_campaign_id?: string | null;
          column_mappings?: Json;
          error?: string | null;
          error_summary?: Json;
          created_by?: string | null;
          approved_at?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_jobs: {
        Row: {
          id: string;
          organization_id: string;
          filename: string;
          total_rows: number;
          inserted_count: number;
          updated_count: number;
          skipped_count: number;
          duplicate_count: number;
          invalid_count: number;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          strategy: 'skip' | 'update_missing' | 'overwrite';
          target_campaign_id: string | null;
          column_mappings: Json;
          error_summary: Json;
          created_by: string | null;
          approved_at?: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          filename: string;
          total_rows?: number;
          inserted_count?: number;
          updated_count?: number;
          skipped_count?: number;
          duplicate_count?: number;
          invalid_count?: number;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          strategy?: 'skip' | 'update_missing' | 'overwrite';
          target_campaign_id?: string | null;
          column_mappings?: Json;
          error_summary?: Json;
          created_by?: string | null;
          approved_at?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          filename?: string;
          total_rows?: number;
          inserted_count?: number;
          updated_count?: number;
          skipped_count?: number;
          duplicate_count?: number;
          invalid_count?: number;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          strategy?: 'skip' | 'update_missing' | 'overwrite';
          target_campaign_id?: string | null;
          column_mappings?: Json;
          error_summary?: Json;
          created_by?: string | null;
          approved_at?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_events: {
        Row: {
          id: string;
          organization_id: string;
          campaign_id: string;
          event_type: string;
          metadata: Json;
          created_at: string;
          actor_user_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          campaign_id: string;
          event_type: string;
          metadata?: Json;
          created_at?: string;
          actor_user_id?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          campaign_id?: string;
          event_type?: string;
          metadata?: Json;
          created_at?: string;
          actor_user_id?: string | null;
        };
        Relationships: [];
      };
      email_automation_settings: {
        Row: {
          id: string;
          organization_id: string;
          enabled: boolean;
          paused: boolean;
          hourly_send_limit: number;
          sender_name: string;
          company_blurb: string;
          inbound_configured: boolean;
          sender_domain_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          enabled?: boolean;
          paused?: boolean;
          hourly_send_limit?: number;
          sender_name?: string;
          company_blurb?: string;
          inbound_configured?: boolean;
          sender_domain_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          enabled?: boolean;
          paused?: boolean;
          hourly_send_limit?: number;
          sender_name?: string;
          company_blurb?: string;
          inbound_configured?: boolean;
          sender_domain_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_suppressions: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual' | 'stop_all';
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual' | 'stop_all';
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          reason?: 'bounce' | 'complaint' | 'unsubscribe' | 'manual' | 'stop_all';
          created_at?: string;
        };
        Relationships: [];
      };
      email_jobs: {
        Row: {
          id: string;
          organization_id: string;
          call_id: string;
          lead_id: string | null;
          campaign_id: string | null;
          idempotency_key: string;
          status: string;
          qualification: Json | null;
          eligibility_reasons: Json;
          draft: Json | null;
          attempts: number;
          next_attempt_at: string | null;
          locked_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          call_id: string;
          lead_id?: string | null;
          campaign_id?: string | null;
          idempotency_key: string;
          status?: string;
          qualification?: Json | null;
          eligibility_reasons?: Json;
          draft?: Json | null;
          attempts?: number;
          next_attempt_at?: string | null;
          locked_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          call_id?: string;
          lead_id?: string | null;
          campaign_id?: string | null;
          idempotency_key?: string;
          status?: string;
          qualification?: Json | null;
          eligibility_reasons?: Json;
          draft?: Json | null;
          attempts?: number;
          next_attempt_at?: string | null;
          locked_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_messages: {
        Row: {
          id: string;
          job_id: string;
          organization_id: string;
          lead_id: string | null;
          campaign_id: string | null;
          call_id: string | null;
          to_email: string;
          from_email: string;
          reply_to: string | null;
          subject: string;
          html_body: string;
          text_body: string;
          category: string;
          resend_id: string | null;
          idempotency_key: string;
          status: string;
          last_error: string | null;
          accepted_at: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          organization_id: string;
          lead_id?: string | null;
          campaign_id?: string | null;
          call_id?: string | null;
          to_email: string;
          from_email: string;
          reply_to?: string | null;
          subject: string;
          html_body: string;
          text_body: string;
          category: string;
          resend_id?: string | null;
          idempotency_key: string;
          status?: string;
          last_error?: string | null;
          accepted_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          organization_id?: string;
          lead_id?: string | null;
          campaign_id?: string | null;
          call_id?: string | null;
          to_email?: string;
          from_email?: string;
          reply_to?: string | null;
          subject?: string;
          html_body?: string;
          text_body?: string;
          category?: string;
          resend_id?: string | null;
          idempotency_key?: string;
          status?: string;
          last_error?: string | null;
          accepted_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_events: {
        Row: {
          id: string;
          organization_id: string;
          message_id: string | null;
          job_id: string | null;
          event_type: string;
          provider_event_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          message_id?: string | null;
          job_id?: string | null;
          event_type: string;
          provider_event_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          message_id?: string | null;
          job_id?: string | null;
          event_type?: string;
          provider_event_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      email_audit_log: {
        Row: {
          id: string;
          organization_id: string;
          lead_id: string | null;
          call_id: string | null;
          job_id: string | null;
          action: string;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          lead_id?: string | null;
          call_id?: string | null;
          job_id?: string | null;
          action: string;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          lead_id?: string | null;
          call_id?: string | null;
          job_id?: string | null;
          action?: string;
          detail?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      email_templates: {
        Row: {
          id: string;
          organization_id: string;
          campaign_id: string | null;
          name: string;
          subject: string;
          body_html: string;
          body_text: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          campaign_id?: string | null;
          name: string;
          subject: string;
          body_html: string;
          body_text: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          campaign_id?: string | null;
          name?: string;
          subject?: string;
          body_html?: string;
          body_text?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_first_organization: {
        Args: {
          org_name: string;
        };
        Returns: string;
      };
      import_leads: {
        Args: {
          filename: string;
          rows: Json;
        };
        Returns: Json;
      };
      claim_email_job: {
        Args: {
          target_id: string;
          call_ready: boolean;
        };
        Returns: string;
      };
      redact_expired_email_bodies: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      claim_next_campaign_lead: {
        Args: {
          p_campaign_id: string;
          p_worker_id: string;
          p_claim_duration_seconds?: number;
        };
        Returns: {
          campaign_lead_id: string;
          campaign_id: string;
          lead_id: string;
          attempt_count: number;
          first_name: string;
          last_name: string;
          full_name: string;
          company_name: string;
          phone: string;
          phone_e164: string;
          timezone: string;
          claimed_at: string;
          claim_expires_at: string;
        }[];
      };
      check_shared_rate_limit: {
        Args: {
          p_key: string;
          p_limit: number;
          p_window_ms: number;
        };
        Returns: {
          allowed: boolean;
          current_count: number;
          remaining: number;
          reset_ms: number;
        }[];
      };
      enroll_leads_in_campaign: {
        Args: {
          p_campaign_id: string;
          p_lead_ids: string[];
          p_actor_id?: string | null;
        };
        Returns: {
          campaign_id: string;
          enrolled_count: number;
          skipped_duplicate: number;
          skipped_dnc: number;
          skipped_invalid: number;
          skipped_capacity: number;
          total_enrolled_now: number;
          enrolled_ids: string[];
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
