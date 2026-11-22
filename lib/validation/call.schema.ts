import { z } from 'zod';

export const callStatusSchema = z.enum([
  'queued',
  'ringing',
  'in_progress',
  'completed',
  'busy',
  'no_answer',
  'failed',
  'cancelled',
]);

export const callDirectionSchema = z.enum(['outbound', 'inbound']);

export const callEventSchema = z.object({
  callId: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID format'),
  eventType: z.enum([
    'created',
    'queued',
    'dialing',
    'ringing',
    'answered',
    'connected',
    'ai_speaking',
    'prospect_speaking',
    'processing',
    'completed',
    'failed',
    'busy',
    'no_answer',
    'cancelled',
    'recording_ready',
    'transcript_ready',
  ]),
  providerEventId: z.string().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime().optional(),
});

export type CallEventInput = z.infer<typeof callEventSchema>;

export const dispositionAssignSchema = z.object({
  callId: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID format'),
  leadId: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID format'),
  dispositionCode: z.string().min(1),
  notes: z.string().max(1000).optional(),
  scheduleCallbackAt: z.string().datetime().optional(),
  bookAppointmentAt: z.string().datetime().optional(),
});

export type DispositionAssignInput = z.infer<typeof dispositionAssignSchema>;
