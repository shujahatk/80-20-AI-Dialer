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
    case 'needs-review':
    case 'needs_review':
    case 'engaged':
      return 'Needs Review';
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
    case 'needs-review':
    case 'needs_review':
    case 'engaged':
      return 'warning';
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
  const norm = String(outcome || '').trim().toUpperCase();
  switch (norm) {
    case 'QUALIFIED':
    case 'QUALIFIED_FOLLOWUP':
      return 'Qualified';
    case 'NEEDS_REVIEW':
    case 'NEEDS-REVIEW':
      return 'Needs Review';
    case 'CALLBACK_REQUESTED':
    case 'CALLBACK_SCHEDULED':
    case 'CALLBACK':
      return 'Callback Requested';
    case 'FOLLOW_UP_REQUIRED':
    case 'FOLLOW_UP':
    case 'FOLLOWUP':
      return 'Follow-up Required';
    case 'INTERESTED':
      return 'Interested';
    case 'NOT_INTERESTED':
      return 'Not Interested';
    case 'NOT_QUALIFIED':
      return 'Not Qualified';
    case 'REJECTED':
      return 'Rejected';
    case 'NO_ANSWER':
      return 'No Answer';
    case 'BUSY':
      return 'Busy';
    case 'VOICEMAIL':
    case 'VOICEMAIL_DROPPED':
      return 'Voicemail';
    case 'FAILED':
      return 'Failed';
    case 'COMPLETED':
      return 'Completed';
    case 'DO_NOT_CALL':
    case 'DNC':
      return 'Do Not Call';
    case 'BOOKED_MEETING':
    case 'APPOINTMENT':
      return 'Meeting booked';
    case 'CONNECTED':
      return 'Answered';
    default:
      return fallback || outcome || 'Completed';
  }
}

export function callOutcomeTone(outcome?: CallOutcome | string): BadgeTone {
  const norm = String(outcome || '').trim().toUpperCase();
  switch (norm) {
    case 'QUALIFIED':
    case 'QUALIFIED_FOLLOWUP':
    case 'BOOKED_MEETING':
    case 'APPOINTMENT':
      return 'success';
    case 'NEEDS_REVIEW':
    case 'NEEDS-REVIEW':
    case 'CALLBACK_REQUESTED':
    case 'CALLBACK_SCHEDULED':
    case 'CALLBACK':
      return 'warning';
    case 'FOLLOW_UP_REQUIRED':
    case 'FOLLOW_UP':
    case 'FOLLOWUP':
    case 'INTERESTED':
    case 'CONNECTED':
      return 'info';
    case 'DO_NOT_CALL':
    case 'DNC':
    case 'FAILED':
      return 'error';
    case 'NOT_INTERESTED':
    case 'NOT_QUALIFIED':
    case 'REJECTED':
    case 'NO_ANSWER':
    case 'BUSY':
    case 'VOICEMAIL':
    case 'VOICEMAIL_DROPPED':
    case 'COMPLETED':
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
