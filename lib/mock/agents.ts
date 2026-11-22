import type { AiAgent } from '@/types';

export const mockAgentsList: AiAgent[] = [
  {
    id: 'ag_rachel',
    name: 'Rachel - Enterprise Outbound v2',
    role: 'Senior Outbound SDR specialized in B2B Freight Logistics & Cold Pipeline Acceleration',
    mandate: 'Autonomous enterprise pipeline generation with multi-depot qualification',
    status: 'active',
    rank: 1,
    voiceProvider: 'Retell AI',
    voiceName: 'Rachel - Retell Neural',
    voiceModel: 'Retell Custom LLM (Claude 3.5)',
    vocalTone: 'Consultative',
    speedCadence: 1.05,
    stability: 72,
    similarityWarmth: 85,
    languageModel: 'English (US - West Coast / Neutral)',
    interruptionThresholdMs: 400,
    noiseSuppression: 'High (Crisp)',
    latencyMode: 'Ultra-Low',
    systemPrompt: `ROLE & GUARDRAILS: STRICT_JSON_FLOW = ON
You are Rachel, an elite Business Development Executive at RM Logistics. Speak with crisp authority, rapid cadence, and strategic curiosity.

<Rule_1> Never deliver monologues longer than 2.5 sentences. Always end with a consultative checkpoint question.
<Rule_2> If {{fleet_size}} > 50 units, pivot straight into dedicated carrier freight margin automation.
<Rule_3> Disarm resistance using tactical acknowledgement. Never argue.`,
    scriptPhases: [
      {
        id: 1,
        title: 'Opening Hook & Disarming Permission',
        scriptText:
          'Hi {{first_name}}, this is Rachel calling from RM Logistics Automation. I noticed {{company}} operates roughly {{fleet_size}} regional assets. Catching you at an okay minute, or are you mid-dispatch?',
        passRate: '91% Pass Rate',
      },
      {
        id: 2,
        title: 'Qualification Criteria (BANT Protocol)',
        scriptText: 'Evaluate fleet capacity and existing telematics setup (Samsara / Motive).',
        isGate: true,
        criteria: ['Fleet Size > 50 Trucks', 'Active TMS / ELD (Samsara/Motive)'],
      },
      {
        id: 3,
        title: 'Dynamic Objection Handling Matrix',
        scriptText: 'Branching tree based on prospect resistance cues.',
      },
      {
        id: 4,
        title: 'Calendar Integration & Slot Lock',
        scriptText:
          'Auto-detect prospect local timezone (CST) and present two exact timeslots within next 48h using ChiliPiper API.',
      },
    ],
    objectionRules: [
      {
        pattern: 'IF MATCH: "Not interested" / "Busy"',
        pivotStrategy: 'Pivot: Acknowledge time constraint; ask for 20-second summary benchmark.',
      },
      {
        pattern: 'IF MATCH: "Using competitor / {{competitor}}"',
        pivotStrategy: "Counter: Highlight RM's verified 18% deadhead reduction over legacy routing.",
      },
      {
        pattern: 'IF MATCH: "Just send info over email"',
        pivotStrategy: 'Action: Validate target email address and lock down 5-min briefing slot.',
      },
    ],
    stats: {
      callsMade: 642,
      bookingRate: 18.2,
      avgLatencyMs: 98,
    },
  },
  {
    id: 'ag_marcus',
    name: 'Marcus - Nurture & Qualification',
    role: 'Mid-market pipeline follow-up specialist',
    mandate: 'Lead re-engagement and decision maker discovery',
    status: 'active',
    rank: 2,
    voiceProvider: 'ElevenLabs',
    voiceName: 'Marcus - Confident Specialist',
    voiceModel: 'Turbo v2.5',
    vocalTone: 'Professional',
    speedCadence: 1.0,
    stability: 75,
    similarityWarmth: 80,
    languageModel: 'English (US - Neutral)',
    interruptionThresholdMs: 450,
    noiseSuppression: 'High',
    latencyMode: 'Low',
    systemPrompt: 'You are Marcus, follow-up specialist for mid-market fleets.',
    scriptPhases: [],
    objectionRules: [],
    stats: {
      callsMade: 514,
      bookingRate: 14.6,
      avgLatencyMs: 115,
    },
  },
  {
    id: 'ag_elena',
    name: 'Elena - Inbound Triage',
    role: 'Rapid inbound routing and instant callback concierge',
    mandate: 'Sub-60s triage for web form inquiries',
    status: 'active',
    rank: 3,
    voiceProvider: 'ElevenLabs',
    voiceName: 'Elena - Consultative Closer',
    voiceModel: 'Turbo v2.5',
    vocalTone: 'Empathetic',
    speedCadence: 1.1,
    stability: 70,
    similarityWarmth: 88,
    languageModel: 'English (UK / Consultative)',
    interruptionThresholdMs: 380,
    noiseSuppression: 'Ultra-High',
    latencyMode: 'Ultra-Low',
    systemPrompt: 'You are Elena, instant triage agent for inbound leads.',
    scriptPhases: [],
    objectionRules: [],
    stats: {
      callsMade: 326,
      bookingRate: 11.9,
      avgLatencyMs: 84,
    },
  },
];
