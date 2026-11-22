import { z } from 'zod';

export const agentCreateSchema = z.object({
  name: z.string().min(2, 'Agent name required').max(100),
  persona: z.string().min(2, 'Persona description required').max(200),
  status: z.enum(['draft', 'ready', 'archived', 'active', 'standby', 'deprecated']).default('ready'),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  greeting: z.string().min(2, 'Greeting phrase is required'),
  voiceProvider: z.enum(['elevenlabs', 'openai', 'deepgram']).default('elevenlabs'),
  voiceId: z.string().min(1, 'Voice ID is required'),
  speakingSpeed: z.number().min(0.5).max(2.0).default(1.05),
  stability: z.number().min(0).max(1).default(0.72),
  similarity: z.number().min(0).max(1).default(0.85),
  qualificationRules: z.record(z.string(), z.unknown()).default({}),
  objectionRules: z.record(z.string(), z.unknown()).default({}),
  closingRules: z.record(z.string(), z.unknown()).default({}),
  handoffRules: z.record(z.string(), z.unknown()).default({}),
});

export type AgentCreateInput = z.infer<typeof agentCreateSchema>;
