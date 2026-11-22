/**
 * RM AI DIALER - CSV IMPORT EXECUTION & DEDUPLICATION ENGINE
 * Processes parsed CSV records, detects duplicates, enforces DNC immutability,
 * and chunks persistence for high-throughput batch ingestion.
 */

import { normalizePhone } from '@/lib/telephony/phone';
import { type RmSystemField } from './mapping';
import type { LeadRow, LeadInsert } from '@/repositories/leads.repository';
import type { Json } from '@/lib/supabase/types';

export type DuplicateStrategy = 'skip' | 'update_missing' | 'overwrite';

export interface ColumnMappingConfig {
  [csvHeader: string]: RmSystemField;
}

export interface NormalizedImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  firstName: string;
  lastName: string;
  companyName: string;
  jobTitle: string;
  phone: string;
  phoneE164: string;
  email: string | null;
  country: string;
  region: string;
  city: string;
  timezone: string;
  tags: string[];
  note: string | null;
  customFields: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
  isDuplicate?: boolean;
  isExistingDnc?: boolean;
  matchedExistingLeadId?: string;
}

export interface ImportProblemRow {
  rowNumber: number;
  name: string;
  phone: string;
  issueType: 'invalid_phone' | 'invalid_email' | 'dnc_protected' | 'duplicate';
  issue: string;
  details: string;
}

export interface CsvPreviewSummary {
  totalRows: number;
  readyRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  dncCount: number;
  warnings: string[];
  sampleRows: NormalizedImportRow[];
  problemRows: ImportProblemRow[];
}

/**
 * Normalizes raw CSV row records using user-configured column mappings.
 */
export function normalizeCsvRows(
  rows: Record<string, string>[],
  mappings: ColumnMappingConfig,
  defaultCountry: string = 'US'
): NormalizedImportRow[] {
  return rows.map((row, idx) => {
    const rowNumber = idx + 1;
    const errors: string[] = [];

    let firstName = '';
    let lastName = '';
    let fullName = '';
    let companyName = '';
    let jobTitle = '';
    let phoneRaw = '';
    let emailRaw = '';
    let city = '';
    let region = '';
    let country = defaultCountry;
    let timezone = 'America/New_York';
    let note: string | null = null;
    const tags: string[] = [];
    const customFields: Record<string, unknown> = {};

    for (const [csvCol, systemField] of Object.entries(mappings)) {
      const val = (row[csvCol] ?? '').trim();
      if (!val || systemField === 'do_not_map') continue;

      switch (systemField) {
        case 'first_name':
          firstName = val;
          break;
        case 'last_name':
          lastName = val;
          break;
        case 'full_name':
          fullName = val;
          break;
        case 'company_name':
          companyName = val;
          break;
        case 'job_title':
          jobTitle = val;
          break;
        case 'phone':
          phoneRaw = val;
          break;
        case 'email':
          emailRaw = val;
          break;
        case 'city':
          city = val;
          break;
        case 'region':
          region = val;
          break;
        case 'country':
          country = val;
          break;
        case 'timezone':
          timezone = val;
          break;
        case 'status':
          customFields['imported_status'] = val.toLowerCase();
          break;
        case 'priority':
          customFields['imported_priority'] = val.toLowerCase();
          break;
        case 'fleet_size':
          customFields['fleet_size'] = val;
          break;
        case 'tags':
          val.split(/[,;|]/).forEach((t) => {
            const cleanTag = t.trim();
            if (cleanTag) tags.push(cleanTag);
          });
          break;
        case 'notes':
          note = val;
          break;
        case 'custom_fields':
          customFields[csvCol.toLowerCase().replace(/[^a-z0-9]/g, '_')] = val;
          break;
      }
    }

    // Handle full_name splitting if first/last are not explicitly separated
    if (!firstName && fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || 'Unknown';
      lastName = parts.slice(1).join(' ') || 'Contact';
    } else if (!firstName && !fullName) {
      firstName = 'Unknown';
      lastName = lastName || 'Prospect';
    } else if (!lastName) {
      lastName = 'Contact';
    }

    // Defaults for logistics/telephony CRM
    if (!companyName) {
      companyName = 'Commercial Account';
    }
    if (!jobTitle) {
      jobTitle = 'Decision Maker';
    }

    // Phone validation & normalization
    const phoneResult = normalizePhone(phoneRaw, country);
    let phoneE164 = '';
    if (!phoneResult.isValid || !phoneResult.e164) {
      errors.push(`Invalid phone format "${phoneRaw}": ${phoneResult.reason ?? 'Failed normalization'}`);
    } else {
      phoneE164 = phoneResult.e164;
    }

    // Email validation
    let email: string | null = null;
    if (emailRaw) {
      if (emailRaw.includes('@') && emailRaw.includes('.')) {
        email = emailRaw.toLowerCase();
      } else {
        errors.push(`Invalid email format: "${emailRaw}"`);
      }
    }

    const isValid = errors.length === 0 && Boolean(phoneE164);

    return {
      rowNumber,
      raw: row,
      firstName,
      lastName,
      companyName,
      jobTitle,
      phone: phoneRaw || phoneE164,
      phoneE164,
      email,
      country,
      region: region || 'US',
      city: city || 'New York',
      timezone,
      tags,
      note,
      customFields,
      isValid,
      errors,
    };
  });
}

/**
 * Cross-references normalized rows against existing database leads to detect
 * duplicates and existing DNC flags before database insertion.
 */
export function detectDuplicatesAndDnc(
  rows: NormalizedImportRow[],
  existingLeads: LeadRow[]
): {
  annotatedRows: NormalizedImportRow[];
  duplicateCount: number;
  dncCount: number;
  problemRows: ImportProblemRow[];
} {
  const phoneMap = new Map<string, LeadRow>();
  const emailMap = new Map<string, LeadRow>();
  const nameCompanyMap = new Map<string, LeadRow>();

  for (const lead of existingLeads) {
    if (lead.phone_e164) phoneMap.set(lead.phone_e164, lead);
    if (lead.email) emailMap.set(lead.email.toLowerCase(), lead);
    if (lead.first_name && lead.company_name) {
      const key = `${lead.first_name.trim().toLowerCase()}|${(lead.last_name || '').trim().toLowerCase()}|${lead.company_name.trim().toLowerCase()}`;
      nameCompanyMap.set(key, lead);
    }
  }

  let duplicateCount = 0;
  let dncCount = 0;
  const problemRows: ImportProblemRow[] = [];

  const annotatedRows = rows.map((row) => {
    let match: LeadRow | undefined;

    // Primary: Match by normalized phone
    if (row.phoneE164 && phoneMap.has(row.phoneE164)) {
      match = phoneMap.get(row.phoneE164);
    } 
    // Primary: Match by email
    else if (row.email && emailMap.has(row.email.toLowerCase())) {
      match = emailMap.get(row.email.toLowerCase());
    } 
    // Secondary: Match by Full Name + Company (only if non-generic)
    else if (
      row.firstName &&
      row.firstName !== 'Unknown' &&
      row.companyName &&
      row.companyName !== 'Commercial Account'
    ) {
      const key = `${row.firstName.trim().toLowerCase()}|${row.lastName.trim().toLowerCase()}|${row.companyName.trim().toLowerCase()}`;
      if (nameCompanyMap.has(key)) {
        match = nameCompanyMap.get(key);
      }
    }

    if (!row.isValid) {
      problemRows.push({
        rowNumber: row.rowNumber,
        name: `${row.firstName} ${row.lastName}`.trim(),
        phone: row.phone || 'None',
        issueType: 'invalid_phone',
        issue: 'Invalid phone number',
        details: row.errors.join('; ') || 'Missing or malformed phone number',
      });
    }

    if (match) {
      duplicateCount++;
      const isExistingDnc = Boolean(match.is_dnc);
      if (isExistingDnc) {
        dncCount++;
        problemRows.push({
          rowNumber: row.rowNumber,
          name: `${row.firstName} ${row.lastName}`.trim(),
          phone: row.phone || row.phoneE164,
          issueType: 'dnc_protected',
          issue: 'Do Not Call protected',
          details: `Matches existing lead marked DNC (${match.dnc_reason || 'Protected'})`,
        });
      } else {
        problemRows.push({
          rowNumber: row.rowNumber,
          name: `${row.firstName} ${row.lastName}`.trim(),
          phone: row.phone || row.phoneE164,
          issueType: 'duplicate',
          issue: 'Possible duplicate',
          details: `Matches existing contact "${match.full_name}" at ${match.company_name}`,
        });
      }

      return {
        ...row,
        isDuplicate: true,
        isExistingDnc,
        matchedExistingLeadId: match.id,
      };
    }

    return row;
  });

  return {
    annotatedRows,
    duplicateCount,
    dncCount,
    problemRows,
  };
}

/**
 * Prepares lead database operations honoring deduplication strategy & DNC preservation.
 */
export function buildDatabaseOperations(
  rows: NormalizedImportRow[],
  existingLeads: LeadRow[],
  strategy: DuplicateStrategy,
  organizationId: string
): {
  toInsert: LeadInsert[];
  toUpdate: { id: string; updates: Partial<LeadInsert> }[];
  skippedCount: number;
} {
  const existingById = new Map<string, LeadRow>();
  for (const l of existingLeads) existingById.set(l.id, l);

  const toInsert: LeadInsert[] = [];
  const toUpdate: { id: string; updates: Partial<LeadInsert> }[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    if (!row.isValid) {
      skippedCount++;
      continue;
    }

    if (row.isDuplicate && row.matchedExistingLeadId) {
      const existing = existingById.get(row.matchedExistingLeadId);

      if (strategy === 'skip') {
        skippedCount++;
        continue;
      }

      if (strategy === 'update_missing' && existing) {
        const updates: Partial<LeadInsert> = {};

        // Only fill empty/unpopulated fields
        if (!existing.email && row.email) updates.email = row.email;
        if (!existing.job_title && row.jobTitle) updates.job_title = row.jobTitle;
        if (!existing.city && row.city) updates.city = row.city;
        if (!existing.region && row.region) updates.region = row.region;

        // CRITICAL: DNC state MUST NEVER BE CLEARED!
        if (existing.is_dnc) {
          updates.is_dnc = true;
          updates.dnc_reason = existing.dnc_reason;
        }

        if (Object.keys(updates).length > 0) {
          toUpdate.push({ id: existing.id, updates });
        } else {
          skippedCount++;
        }
        continue;
      }

      if (strategy === 'overwrite' && existing) {
        const updates: Partial<LeadInsert> = {
          first_name: row.firstName,
          last_name: row.lastName,
          company_name: row.companyName,
          job_title: row.jobTitle,
          city: row.city,
          region: row.region,
          country: row.country,
          timezone: row.timezone,
          custom_fields: {
            ...(typeof existing.custom_fields === 'object' && existing.custom_fields !== null
              ? (existing.custom_fields as Record<string, unknown>)
              : {}),
            ...row.customFields,
          } as Json,
        };

        if (row.email) updates.email = row.email;

        // CRITICAL: DNC state CANNOT be reset by overwrite!
        if (existing.is_dnc) {
          updates.is_dnc = true;
          updates.dnc_reason = existing.dnc_reason;
        }

        toUpdate.push({ id: existing.id, updates });
        continue;
      }
    }

    // Unique record - insert as fresh lead
    toInsert.push({
      organization_id: organizationId,
      first_name: row.firstName,
      last_name: row.lastName,
      company_name: row.companyName,
      job_title: row.jobTitle,
      phone: row.phone,
      phone_e164: row.phoneE164,
      email: row.email,
      country: row.country,
      region: row.region,
      city: row.city,
      timezone: row.timezone,
      source: 'csv_import',
      status: 'new',
      priority: 'medium',
      is_dnc: false,
      custom_fields: row.customFields as Json,
    });
  }

  return {
    toInsert,
    toUpdate,
    skippedCount,
  };
}
