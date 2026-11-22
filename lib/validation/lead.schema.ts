import { z } from 'zod';

export const leadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'ENGAGED',
  'TECHNICAL_EVALUATION',
  'COMMERCIAL_DISCUSSION',
  'new',
  'queued',
  'in_progress',
  'contacted',
  'qualified',
  'converted',
  'unqualified',
  'dnc',
]);

export const leadPrioritySchema = z.enum(['urgent', 'high', 'medium', 'low']);

export const leadCreateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  companyName: z.string().min(1, 'Company name is required').max(150),
  jobTitle: z.string().max(150).optional().default(''),
  phone: z.string().min(7, 'Invalid phone number'),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in standard E.164 format (+1XXXXXXXXXX)')
    .optional(),
  email: z.string().email('Invalid email address').optional().nullable(),
  country: z.string().default('United States'),
  region: z.string().default('US'),
  city: z.string().default('New York'),
  timezone: z.string().default('America/New_York'),
  source: z.string().default('manual_entry'),
  status: leadStatusSchema.default('new'),
  priority: leadPrioritySchema.default('medium'),
  isDnc: z.boolean().default(false),
  dncReason: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  note: z.string().optional().nullable(),
});

export type LeadCreateInput = z.input<typeof leadCreateSchema>;

export const leadUpdateSchema = leadCreateSchema.partial();
export type LeadUpdateInput = z.input<typeof leadUpdateSchema>;

export const leadBulkActionSchema = z.object({
  action: z.enum(['dnc', 'status', 'priority', 'archive', 'tag']),
  leadIds: z.array(z.string()).min(1, 'At least one lead required'),
  status: leadStatusSchema.optional(),
  priority: leadPrioritySchema.optional(),
  dncReason: z.string().optional(),
  tagName: z.string().optional(),
});
export type LeadBulkActionInput = z.infer<typeof leadBulkActionSchema>;

export const leadCsvColumnMappingSchema = z.object({
  fullNameField: z.string().optional(),
  firstNameField: z.string().optional(),
  lastNameField: z.string().optional(),
  companyField: z.string(),
  phoneField: z.string(),
  emailField: z.string().optional(),
  titleField: z.string().optional(),
  cityField: z.string().optional(),
  stateField: z.string().optional(),
  timezoneField: z.string().optional(),
});

export type LeadCsvColumnMapping = z.infer<typeof leadCsvColumnMappingSchema>;
