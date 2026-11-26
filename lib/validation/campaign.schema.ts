import { z } from 'zod';

export const campaignStatusSchema = z.enum([
  'draft',
  'ready',
  'paused',
  'archived',
  'scheduled',
  'running',
  'completed',
  'cancelled',
]);
export type CampaignStatusType = z.infer<typeof campaignStatusSchema>;

export const campaignCreateSchema = z.object({
  name: z.string().min(2, 'Campaign name must be at least 2 characters').max(150),
  description: z.string().max(500).optional().default(''),
  status: campaignStatusSchema.default('draft'),
  aiAgentId: z.string().optional().nullable(),
  timezone: z.string().default('America/New_York'),
  callingDays: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  callingWindowStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM (e.g. 09:00)')
    .default('09:00'),
  callingWindowEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM (e.g. 17:00)')
    .default('17:00'),
  maxAttemptsPerLead: z.number().int().min(1).max(10).default(3),
  retryDelayMinutes: z.number().int().min(5).max(1440).default(60),
  concurrencyLimit: z.number().int().min(1).max(50).default(10),
  dailyAttemptLimit: z.number().int().min(1).max(10000).default(500),
  emailFollowupEnabled: z.boolean().default(false),
  emailSubject: z.string().optional().nullable(),
  emailBody: z.string().optional().nullable(),
  companySignature: z.string().optional().nullable(),
  attachments: z.array(z.string()).optional().default([]),
  qualificationCriteria: z.record(z.string(), z.any()).optional().nullable(),
  requiredCommercialInfo: z.array(z.string()).optional().default([]),
  emailInstructions: z.string().optional().nullable(),
  emailLawfulBasis: z.string().optional().nullable(),
  emailLawfulBasisNote: z.string().optional().nullable(),
});

export type CampaignCreateInput = z.input<typeof campaignCreateSchema>;
export type CampaignCreateOutput = z.output<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignCreateSchema.partial();
export type CampaignUpdateInput = z.input<typeof campaignUpdateSchema>;

export const campaignLeadEnrollSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, 'At least one lead is required'),
});
export type CampaignLeadEnrollInput = z.infer<typeof campaignLeadEnrollSchema>;

export const campaignActionSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'complete', 'cancel']),
});
export type CampaignActionInput = z.infer<typeof campaignActionSchema>;
