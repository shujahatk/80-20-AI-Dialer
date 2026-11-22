import type { CallOutcome, LeadStatus } from '@/types';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export function leadStatusLabel(status: LeadStatus | string): string {
  switch (status) {
    case 'meeting-booked':
    case 'converted':
      return 'Meeting booked';
    case 'voicemail-left':
      return 'Voicemail';
    case 'objection-handled':
      return 'Interested';
    case 'callback-scheduled':
    case 'callback':
      return 'Callback';
    case 'in-queue':
    case 'queued':
      return 'In queue';
    case 'connected':
    case 'contacted':
      return 'Contacted';
    case 'qualified':
      return 'Qualified';
    case 'dnc':
      return 'Do not call';
    case 'unreachable':
    case 'unqualified':
      return 'Unreachable';
    case 'dialing':
    case 'in_progress':
      return 'Dialing';
    case 'new':
    default:
      return 'New';
  }
}

export function leadStatusTone(status: LeadStatus | string): BadgeTone {
  switch (status) {
    case 'meeting-booked':
    case 'converted':
    case 'qualified':
      return 'success';
    case 'callback-scheduled':
    case 'callback':
    case 'dialing':
      return 'warning';
    case 'dnc':
    case 'unreachable':
    case 'unqualified':
      return 'error';
    case 'objection-handled':
    case 'connected':
    case 'contacted':
      return 'primary';
    case 'in-queue':
    case 'queued':
      return 'info';
    default:
      return 'neutral';
  }
}

export function priorityLabel(priority?: string): string {
  if (priority === 'high') return 'High';
  if (priority === 'low') return 'Low';
  return 'Medium';
}

export function priorityTone(priority?: string): BadgeTone {
  if (priority === 'high') return 'error';
  if (priority === 'low') return 'neutral';
  return 'warning';
}

export function callOutcomeLabel(outcome?: string, fallback?: string): string {
  if (fallback && fallback !== outcome) return fallback;
  switch (outcome) {
    case 'booked_meeting':
    case 'appointment':
      return 'Meeting booked';
    case 'qualified_followup':
    case 'qualified':
      return 'Qualified';
    case 'callback_scheduled':
    case 'callback':
      return 'Callback';
    case 'voicemail_dropped':
    case 'voicemail':
      return 'Voicemail';
    case 'not_interested':
      return 'Not interested';
    case 'dnc':
      return 'Do not call';
    case 'failed':
      return 'Failed';
    case 'no_answer':
      return 'No answer';
    case 'connected':
      return 'Answered';
    default:
      return fallback || outcome || 'Completed';
  }
}

export function callOutcomeTone(outcome?: CallOutcome | string): BadgeTone {
  switch (outcome) {
    case 'booked_meeting':
    case 'appointment':
    case 'qualified_followup':
    case 'qualified':
    case 'connected':
      return 'success';
    case 'callback_scheduled':
    case 'callback':
    case 'voicemail_dropped':
    case 'voicemail':
      return 'warning';
    case 'not_interested':
    case 'dnc':
    case 'failed':
    case 'no_answer':
      return 'error';
    default:
      return 'neutral';
  }
}

export function classifyCallBucket(outcome?: string, status?: string): 'answered' | 'no_answer' | 'voicemail' | 'failed' {
  const value = `${outcome || ''} ${status || ''}`.toLowerCase();
  if (value.includes('voicemail')) return 'voicemail';
  if (value.includes('no_answer') || value.includes('busy') || value.includes('unreachable')) return 'no_answer';
  if (value.includes('fail') || value.includes('error') || value.includes('dnc')) return 'failed';
  if (
    value.includes('connected') ||
    value.includes('qualified') ||
    value.includes('appointment') ||
    value.includes('callback') ||
    value.includes('completed') ||
    value.includes('interested')
  ) {
    return 'answered';
  }
  if (value.includes('ring') || value.includes('dial')) return 'no_answer';
  return 'failed';
}
