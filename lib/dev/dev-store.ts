import { mockLeadsList } from '@/lib/mock/leads';
import { mockCampaignsList } from '@/lib/mock/campaigns';
import type { LeadRow } from '@/repositories/leads.repository';
import type { HydratedLeadNote } from '@/repositories/lead-notes.repository';
import type { LeadTagRow } from '@/repositories/lead-tags.repository';
import type { LeadStatusDb, LeadPriorityDb, Json } from '@/lib/supabase/types';
import { normalizePhone } from '@/lib/telephony/phone';

export interface CampaignRecord {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  ai_agent_id: string | null;
  timezone: string;
  calling_days: number[];
  calling_window_start: string;
  calling_window_end: string;
  max_attempts_per_lead: number;
  retry_delay_minutes: number;
  concurrency_limit: number;
  daily_attempt_limit: number;
  start_date: string | null;
  end_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignLeadRecord {
  id: string;
  campaign_id: string;
  lead_id: string;
  attempt_count: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  state: 'pending' | 'queued' | 'calling' | 'completed' | 'abandoned';
  outcome: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  claim_expires_at: string | null;
  final_disposition_id: string | null;
  last_call_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignEventRecord {
  id: string;
  organization_id: string;
  campaign_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

export interface CallRecord {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  lead_id: string | null;
  ai_agent_id: string | null;
  operator_id: string | null;
  provider: string;
  provider_call_id: string | null;
  retell_call_id?: string | null;
  provider_agent_id?: string | null;
  provider_metadata?: Json;
  disconnection_reason?: string | null;
  call_cost?: number;
  direction: 'outbound' | 'inbound';
  status: 'queued' | 'ringing' | 'in_progress' | 'completed' | 'busy' | 'no_answer' | 'failed' | 'cancelled';
  outcome: string | null;
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
}

export interface CallEventRecord {
  id: string;
  organization_id: string;
  call_id: string;
  event_type: string;
  provider_event_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface CallRecordingRecord {
  id: string;
  call_id: string;
  provider: string;
  provider_recording_id: string | null;
  storage_path: string;
  duration_seconds: number;
  mime_type: string;
  status: string;
  created_at: string;
}

export interface CallTranscriptRecord {
  id: string;
  call_id: string;
  speaker: string;
  sequence_number: number;
  text: string;
  started_at_ms: number;
  ended_at_ms: number;
  confidence: number;
  metadata: Record<string, unknown>;
  created_at?: string;
}

export interface WebhookEventRecord {
  id: string;
  provider: string;
  external_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  signature_valid: boolean;
  processing_status: 'received' | 'processed' | 'failed' | 'ignored';
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
  organization_id?: string | null;
}

export interface AgentRecord {
  id: string;
  organization_id: string;
  name: string;
  persona: string;
  active_version_id: string | null;
  status: string;
  retell_agent_id?: string | null;
  retell_llm_id?: string | null;
  retell_knowledge_base_id?: string | null;
  sync_status: 'draft' | 'syncing' | 'synced' | 'failed' | 'stale';
  last_synced_at?: string | null;
  stage_state: 'draft' | 'training' | 'testing' | 'ready' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface AgentVersionRecord {
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
}

export interface AgentKnowledgeRecord {
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
}

export interface AgentSimulationRecord {
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
}

export interface DevStoreData {
  leads: LeadRow[];
  notes: Record<string, HydratedLeadNote[]>;
  tags: Record<string, LeadTagRow[]>;
  campaigns: CampaignRecord[];
  campaignLeads: CampaignLeadRecord[];
  campaignEvents: CampaignEventRecord[];
  calls: CallRecord[];
  callEvents: CallEventRecord[];
  callRecordings: CallRecordingRecord[];
  callTranscripts: CallTranscriptRecord[];
  webhookEvents: WebhookEventRecord[];
  agents: AgentRecord[];
  agentVersions: AgentVersionRecord[];
  agentKnowledge: AgentKnowledgeRecord[];
  agentSimulations: AgentSimulationRecord[];
}

declare global {
  var __rmDevStore: DevStoreData | undefined;
}

function initDevStore(): DevStoreData {
  const defaultOrgId = '00000000-0000-0000-0000-000000000001';

  const leads: LeadRow[] = mockLeadsList.map((m, idx) => {
    const names = m.name.split(' ');
    const firstName = names[0] || 'Unknown';
    const lastName = names.slice(1).join(' ') || 'Contact';
    const phoneNorm = normalizePhone(m.phone, 'US');

    const statusMap: Record<string, LeadStatusDb> = {
      'new': 'new',
      'in-queue': 'queued',
      'dialing': 'in_progress',
      'connected': 'contacted',
      'meeting-booked': 'converted',
      'qualified': 'qualified',
      'unreachable': 'unqualified',
      'dnc': 'dnc',
      'voicemail-left': 'contacted',
      'callback-requested': 'queued',
    };

    return {
      id: m.id || `ld_mock_${idx + 1}`,
      organization_id: defaultOrgId,
      name: m.name,
      company: m.company,
      title: m.title || 'Director',
      temperature: 'COLD',
      do_not_call: m.status === 'dnc',
      deleted_at: null,
      first_name: firstName,
      last_name: lastName,
      full_name: m.name,
      company_name: m.company,
      job_title: m.title || 'Director',
      phone: m.phone,
      phone_e164: phoneNorm.isValid && phoneNorm.e164 ? phoneNorm.e164 : m.phone,
      email: m.email || null,
      country: 'US',
      region: 'IL',
      city: 'Chicago',
      timezone: 'America/Chicago',
      source: 'csv_import',
      status: statusMap[m.status] || 'contacted',
      priority: (idx % 2 === 0 ? 'high' : 'medium') as LeadPriorityDb,
      is_dnc: m.status === 'dnc',
      dnc_reason: m.status === 'dnc' ? 'Customer requested Do-Not-Call' : null,
      is_archived: false,
      archived_at: null,
      last_contacted_at: null,
      next_contact_at: null,
      created_by: null,
      custom_fields: { fleet_size: m.fleetSize },
      created_at: new Date(Date.now() - (idx + 1) * 3600000 * 24).toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const notes: Record<string, HydratedLeadNote[]> = {};
  const tags: Record<string, LeadTagRow[]> = {};

  mockLeadsList.forEach((m) => {
    notes[m.id] = [
      {
        id: `note_${m.id}_1`,
        lead_id: m.id,
        author_id: 'usr_mock_sdr',
        content: `Initial outreach logged for ${m.name} at ${m.company}. Interest verified.`,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        author_name: 'Alex Rivera (SDR)',
        author_avatar: undefined,
      },
    ];

    tags[m.id] = (m.tags || ['Outbound', 'Qualified']).map((tagName, tIdx) => ({
      id: `tag_${m.id}_${tIdx}`,
      organization_id: defaultOrgId,
      name: tagName,
      color: '#0284c7',
    }));
  });

  // Seed Initial Campaigns
  const campaigns: CampaignRecord[] = mockCampaignsList.map((c, idx) => {
    const statusMap: Record<string, CampaignRecord['status']> = {
      live: 'running',
      scheduled: 'scheduled',
      paused: 'paused',
      completed: 'completed',
      archived: 'cancelled',
    };

    return {
      id: c.id || `cmp_mock_${idx + 1}`,
      organization_id: defaultOrgId,
      name: c.name,
      description: c.description,
      status: statusMap[c.status] || 'running',
      ai_agent_id: c.agentId || 'ag_rachel',
      timezone: 'America/New_York',
      calling_days: [1, 2, 3, 4, 5],
      calling_window_start: '09:00',
      calling_window_end: '17:00',
      max_attempts_per_lead: 4,
      retry_delay_minutes: 60,
      concurrency_limit: c.concurrentLines || 10,
      daily_attempt_limit: 500,
      start_date: new Date().toISOString(),
      end_date: null,
      started_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      completed_at: null,
      created_by: 'usr_mock_sdr',
      created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // Seed Campaign Leads for the featured campaign
  const campaignLeads: CampaignLeadRecord[] = [];
  const primaryCampaignId = campaigns[0]?.id || 'cmp_1';

  leads.slice(0, 10).forEach((l, idx) => {
    // Leave DNC leads out of active pending queue
    const isLeadDnc = l.is_dnc || l.status === 'dnc';
    campaignLeads.push({
      id: `cl_mock_${idx + 1}`,
      campaign_id: primaryCampaignId,
      lead_id: l.id,
      attempt_count: idx < 3 ? 1 : 0,
      last_attempt_at: idx < 3 ? new Date(Date.now() - 3600000 * 4).toISOString() : null,
      next_attempt_at: idx === 0 ? new Date(Date.now() + 3600000 * 2).toISOString() : new Date().toISOString(),
      state: isLeadDnc ? 'abandoned' : (idx < 2 ? 'completed' : 'pending'),
      outcome: isLeadDnc ? 'dnc' : (idx === 0 ? 'connected' : (idx === 1 ? 'qualified' : null)),
      claimed_at: null,
      claimed_by: null,
      claim_expires_at: null,
      final_disposition_id: null,
      last_call_id: null,
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  const campaignEvents: CampaignEventRecord[] = [
    {
      id: 'ce_mock_1',
      organization_id: defaultOrgId,
      campaign_id: primaryCampaignId,
      event_type: 'campaign.created',
      metadata: { name: campaigns[0]?.name },
      actor_user_id: 'usr_mock_sdr',
      created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    },
    {
      id: 'ce_mock_2',
      organization_id: defaultOrgId,
      campaign_id: primaryCampaignId,
      event_type: 'campaign.started',
      metadata: { initialLeadCount: 10 },
      actor_user_id: 'usr_mock_sdr',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
  ];

  const calls: CallRecord[] = [
    {
      id: 'call_mock_1',
      organization_id: defaultOrgId,
      campaign_id: primaryCampaignId,
      lead_id: leads[0]?.id || 'ld_mock_1',
      ai_agent_id: 'ag_rachel',
      operator_id: 'usr_mock_sdr',
      provider: 'twilio',
      provider_call_id: 'CA_mock_call_0001',
      direction: 'outbound',
      status: 'completed',
      outcome: 'qualified',
      started_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      ringing_at: new Date(Date.now() - 3600000 * 4 + 4000).toISOString(),
      answered_at: new Date(Date.now() - 3600000 * 4 + 10000).toISOString(),
      ended_at: new Date(Date.now() - 3600000 * 4 + 232000).toISOString(),
      duration_seconds: 232,
      connected_seconds: 222,
      recording_status: 'ready',
      transcript_status: 'ready',
      failure_code: null,
      failure_reason: null,
      sentiment_score: 0.9,
      intent_score: 0.85,
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 4 + 232000).toISOString(),
    },
  ];

  const callEvents: CallEventRecord[] = [
    {
      id: 'ce_mock_1',
      organization_id: defaultOrgId,
      call_id: 'call_mock_1',
      event_type: 'call_created',
      provider_event_id: 'ev_01',
      payload: { direction: 'outbound' },
      occurred_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'ce_mock_2',
      organization_id: defaultOrgId,
      call_id: 'call_mock_1',
      event_type: 'connected',
      provider_event_id: 'ev_02',
      payload: { answered_by: 'human' },
      occurred_at: new Date(Date.now() - 3600000 * 4 + 10000).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 4 + 10000).toISOString(),
    },
    {
      id: 'ce_mock_3',
      organization_id: defaultOrgId,
      call_id: 'call_mock_1',
      event_type: 'completed',
      provider_event_id: 'ev_03',
      payload: { disposition: 'qualified' },
      occurred_at: new Date(Date.now() - 3600000 * 4 + 232000).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 4 + 232000).toISOString(),
    },
  ];

  const callRecordings: CallRecordingRecord[] = [
    {
      id: 'rec_mock_1',
      call_id: 'call_mock_1',
      provider: 'twilio',
      provider_recording_id: 'RE_mock_recording_0001',
      storage_path: 'https://api.twilio.com/2010-04-01/Accounts/AC_mock/Recordings/RE_mock_1',
      duration_seconds: 222,
      mime_type: 'audio/x-wav',
      status: 'completed',
      created_at: new Date(Date.now() - 3600000 * 4 + 235000).toISOString(),
    },
  ];

  const callTranscripts: CallTranscriptRecord[] = [
    {
      id: 'tr_mock_1',
      call_id: 'call_mock_1',
      speaker: 'ai',
      sequence_number: 1,
      text: 'Hi Sarah, this is Rachel calling with RM AI. I was reaching out regarding operations at Apex Freightways. How are you doing today?',
      started_at_ms: 10000,
      ended_at_ms: 16000,
      confidence: 0.99,
      metadata: { voice_id: '21m00Tcm4TlvDq8ikWAM' },
    },
    {
      id: 'tr_mock_2',
      call_id: 'call_mock_1',
      speaker: 'lead',
      sequence_number: 2,
      text: 'Hey Rachel, doing fine thanks. What is this call regarding?',
      started_at_ms: 17000,
      ended_at_ms: 20500,
      confidence: 0.96,
      metadata: {},
    },
    {
      id: 'tr_mock_3',
      call_id: 'call_mock_1',
      speaker: 'ai',
      sequence_number: 3,
      text: 'We help high-volume dispatch and logistics teams automate driver check-ins and qualification calls with zero wait times. Would you be open to a 10-minute demo this Thursday?',
      started_at_ms: 21500,
      ended_at_ms: 29000,
      confidence: 0.98,
      metadata: { voice_id: '21m00Tcm4TlvDq8ikWAM' },
    },
  ];

  const webhookEvents: WebhookEventRecord[] = [];

  const agents: AgentRecord[] = [
    {
      id: 'ag_rachel',
      organization_id: defaultOrgId,
      name: 'Rachel (Enterprise SDR)',
      persona: 'Professional, consultative, and calm SDR representing RM Group for commercial recycling and surplus acquisition.',
      active_version_id: 'ver_rachel_1',
      status: 'active',
      retell_agent_id: 'agent_retell_rachel_01',
      sync_status: 'synced',
      stage_state: 'published',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'ag_marcus',
      organization_id: defaultOrgId,
      name: 'Marcus (Discovery & Volume)',
      persona: 'Direct, focused, and efficient purchasing coordinator for high-volume scrap materials and industrial metal surplus.',
      active_version_id: 'ver_marcus_1',
      status: 'active',
      retell_agent_id: 'agent_retell_marcus_01',
      sync_status: 'synced',
      stage_state: 'published',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'ag_elena',
      organization_id: defaultOrgId,
      name: 'Elena (Contract Follow-up)',
      persona: 'Warm and persistent account representative managing existing contract renewal windows and follow-ups.',
      active_version_id: null,
      status: 'standby',
      retell_agent_id: null,
      sync_status: 'draft',
      stage_state: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const agentVersions: AgentVersionRecord[] = [
    {
      id: 'ver_rachel_1',
      agent_id: 'ag_rachel',
      version_number: 1,
      system_prompt: 'You are Rachel, an enterprise commercial representative for RM Group...',
      greeting: 'Hello {{first_name}}, this is Rachel calling from RM Group regarding industrial raw materials and recycling pickups.',
      voice_provider: 'retell',
      voice_id: '11labs-Adrian',
      speaking_speed: 1.05,
      stability: 0.75,
      similarity: 0.85,
      qualification_rules: {
        decisionMaker: { required: true, question: 'Are you responsible for raw material and recycling contracts?' },
        materialType: { required: true, question: 'What types of industrial surplus or scrap do you generate?' },
        volume: { required: true, question: 'What is your approximate monthly volume or tonnage?' },
      },
      objection_rules: {
        existing_supplier: 'We often work alongside existing contracts to provide backup logistics and better pricing on specialized surplus.',
        not_interested: 'Completely understand. When is your next contract review window so we can provide a competitive quote?',
      },
      closing_rules: {
        target: 'Schedule a 15-minute consultation with an RM technical representative.',
      },
      handoff_rules: {
        triggers: ['human_requested', 'pricing_commitment', 'compliance_inquiry'],
      },
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
  ];

  const agentKnowledge: AgentKnowledgeRecord[] = [
    {
      id: 'kn_1',
      organization_id: defaultOrgId,
      agent_id: 'ag_rachel',
      agent_version_id: 'ver_rachel_1',
      category: 'Company',
      title: 'RM Group Overview',
      content: 'RM Group is a leading European raw material recycling, surplus management, and circular supply chain partner operating across Belgium, France, Germany, and the Netherlands.',
      source_type: 'manual',
      source_url: null,
      retell_knowledge_id: null,
      sync_status: 'synced',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'kn_2',
      organization_id: defaultOrgId,
      agent_id: 'ag_rachel',
      agent_version_id: 'ver_rachel_1',
      category: 'Materials',
      title: 'Accepted Raw Materials',
      content: 'We purchase and recycle non-ferrous metals (copper, aluminum, brass), industrial polymer surplus, electronic scrap (WEEE), and commercial corrugated packaging.',
      source_type: 'manual',
      source_url: null,
      retell_knowledge_id: null,
      sync_status: 'synced',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'kn_3',
      organization_id: defaultOrgId,
      agent_id: 'ag_rachel',
      agent_version_id: 'ver_rachel_1',
      category: 'Compliance',
      title: 'Commercial Commitment Policy',
      content: 'Under no circumstances should the agent quote fixed per-ton prices over the phone. Fixed quotes require site assessment by an RM technical specialist.',
      source_type: 'manual',
      source_url: null,
      retell_knowledge_id: null,
      sync_status: 'synced',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const agentSimulations: AgentSimulationRecord[] = [];

  return {
    leads,
    notes,
    tags,
    campaigns,
    campaignLeads,
    campaignEvents,
    calls,
    callEvents,
    callRecordings,
    callTranscripts,
    webhookEvents,
    agents,
    agentVersions,
    agentKnowledge,
    agentSimulations,
  };
}

export function getDevStore(): DevStoreData {
  if (!globalThis.__rmDevStore) {
    globalThis.__rmDevStore = initDevStore();
  }
  return globalThis.__rmDevStore;
}
