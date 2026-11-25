import type { LeadStatus } from '@/types';
import type { LeadStatusDb } from '@/lib/supabase/types';

/**
 * RM 80/20 AI DIALER — CANONICAL LEAD STATUS MAPPER
 * Authoritative single source of truth for lead status conversions across:
 * - PostgreSQL Database (leads.status enum: NEW, CONTACTED, ENGAGED, TECHNICAL_EVALUATION, COMMERCIAL_DISCUSSION)
 * - Domain Layer (Lead.status: new, contacted, qualified, meeting-booked, dnc, callback-scheduled, unreachable)
 * - API Filters & UI Presentation
 */

/**
 * Converts a database status and DNC flag into the canonical domain LeadStatus.
 */
export function toDomainLeadStatus(
  dbStatus: string | null | undefined,
  isDnc: boolean = false
): LeadStatus {
  if (isDnc) return 'dnc';
  const s = String(dbStatus || 'NEW').trim().toUpperCase();
  switch (s) {
    case 'NEW':
    case 'QUEUED':
      return 'new';
    case 'CONTACTED':
    case 'IN_PROGRESS':
    case 'DIALING':
    case 'CONNECTED':
      return 'contacted';
    case 'ENGAGED':
    case 'TECHNICAL_EVALUATION':
    case 'QUALIFIED':
      return 'qualified';
    case 'COMMERCIAL_DISCUSSION':
    case 'MEETING-BOOKED':
    case 'CONVERTED':
      return 'meeting-booked';
    case 'CALLBACK':
    case 'CALLBACK-SCHEDULED':
      return 'callback-scheduled';
    case 'UNQUALIFIED':
    case 'NOT_INTERESTED':
    case 'UNREACHABLE':
      return 'unreachable';
    case 'DNC':
    case 'DO_NOT_CALL':
      return 'dnc';
    default:
      return 'new';
  }
}

/**
 * Translates a user/UI filter status string into the corresponding database LeadStatusDb values.
 * Returns an empty array if status is 'all' or undefined (meaning no database status filter).
 */
export function toDbLeadStatuses(filterStatus: string | null | undefined): LeadStatusDb[] {
  if (!filterStatus || filterStatus.toLowerCase() === 'all') return [];
  const s = filterStatus.trim().toLowerCase();
  switch (s) {
    case 'new':
    case 'queued':
      return ['NEW'];
    case 'contacted':
    case 'connected':
    case 'dialing':
    case 'in_progress':
      return ['CONTACTED'];
    case 'engaged':
      return ['ENGAGED'];
    case 'qualified':
      return ['ENGAGED', 'TECHNICAL_EVALUATION'];
    case 'meeting-booked':
    case 'converted':
    case 'commercial_discussion':
      return ['COMMERCIAL_DISCUSSION'];
    default: {
      const upper = filterStatus.toUpperCase() as LeadStatusDb;
      const valid: LeadStatusDb[] = ['NEW', 'CONTACTED', 'ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION'];
      return valid.includes(upper) ? [upper] : [];
    }
  }
}

/**
 * Maps a domain lead status or input status to the valid database enum status.
 */
export function toDbLeadStatus(status: string | null | undefined): LeadStatusDb {
  const s = String(status || 'NEW').trim().toUpperCase();
  switch (s) {
    case 'NEW':
    case 'QUEUED':
      return 'NEW';
    case 'CONTACTED':
    case 'CONNECTED':
    case 'DIALING':
    case 'IN_PROGRESS':
    case 'CALLBACK':
    case 'UNQUALIFIED':
      return 'CONTACTED';
    case 'ENGAGED':
    case 'INTERESTED':
    case 'FOLLOW_UP':
      return 'ENGAGED';
    case 'QUALIFIED':
    case 'TECHNICAL_EVALUATION':
      return 'TECHNICAL_EVALUATION';
    case 'COMMERCIAL_DISCUSSION':
    case 'MEETING-BOOKED':
    case 'CONVERTED':
    case 'CONFIRMED':
      return 'COMMERCIAL_DISCUSSION';
    default:
      return 'NEW';
  }
}
