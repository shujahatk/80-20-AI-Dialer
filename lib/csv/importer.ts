/**
 * 80/20 AI DIALER - CSV IMPORT EXECUTION & DEDUPLICATION ENGINE
 * Normalizes lead records, enforces DNC immutability, executes intra-file
 * and database deduplication, and formats data for the Supabase import_leads RPC.
 */

import { normalizePhone } from '@/lib/telephony/phone';
import { type RmSystemField } from './mapping';
import type { LeadRow, LeadInsert, LeadUpdate } from '@/repositories/leads.repository';
import type { Json } from '@/lib/supabase/types';

export type DuplicateStrategy = 'skip' | 'update_missing' | 'overwrite';

export interface ColumnMappingConfig {
  [csvHeader: string]: RmSystemField;
}

export interface NormalizedImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  name: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  phone: string;
  phoneE164: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string;
  timezone: string;
  notes: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  duplicateType?: 'intra_csv' | 'existing_database';
  duplicateReason?: string;
  matchedExistingLeadId?: string;
  isExistingDnc?: boolean;
}

export interface ImportProblemRow {
  rowNumber: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  issueType: 'invalid_data' | 'duplicate_csv' | 'duplicate_database' | 'dnc_protected';
  issue: string;
  details: string;
}

export interface CsvPreviewSummary {
  totalRows: number;
  readyRows: number;
  validRows: number;
  newRows: number;
  invalidRows: number;
  duplicateCount: number;
  intraFileDuplicates: number;
  existingDuplicates: number;
  dncCount: number;
  warnings: string[];
  sampleRows: NormalizedImportRow[];
  problemRows: ImportProblemRow[];
}

const DIRTY_PLACEHOLDERS = new Set([
  '',
  'null',
  'undefined',
  'n/a',
  'na',
  'none',
  'unknown',
  '-',
  '--',
  'nil',
  'nan',
  '#n/a',
]);

/**
 * Checks if a string value is considered empty, dirty, or a placeholder.
 */
export function isDirtyOrEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  const str = String(val).trim().toLowerCase();
  return DIRTY_PLACEHOLDERS.has(str);
}

/**
 * Sanitizes an arbitrary CSV string value.
 * Converts placeholders to empty string and neutralizes spreadsheet formula injection.
 */
export function sanitizeCsvValue(val: unknown): string {
  if (isDirtyOrEmpty(val)) return '';
  const trimmed = String(val).trim();

  // Neutralize spreadsheet formula injection (=, @)
  if (/^[=@]/.test(trimmed)) {
    return "'" + trimmed;
  }
  // Neutralize formula injection with + or - while preserving legitimate international phone numbers (+1...)
  if (/^[+\-]/.test(trimmed)) {
    if (/^\+\d+[\d\s\-\(\)\.]*$/.test(trimmed)) {
      return trimmed;
    }
    return "'" + trimmed;
  }

  return trimmed;
}

/**
 * Normalizes email address (lowercase, whitespace stripped, regex validated).
 */
export function normalizeEmail(rawEmail: unknown): { email: string | null; isValid: boolean } {
  if (isDirtyOrEmpty(rawEmail)) {
    return { email: null, isValid: true };
  }

  const cleaned = String(rawEmail).trim().replace(/\s+/g, '').toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleaned)) {
    return { email: cleaned, isValid: false };
  }

  return { email: cleaned, isValid: true };
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
    const rowNumber = row.__rowNumber ? parseInt(row.__rowNumber, 10) : idx + 2; // header is row 1
    const errors: string[] = [];

    let firstName = '';
    let lastName = '';
    let fullName = '';
    let company = '';
    let title = '';
    let phoneRaw = '';
    let emailRaw = '';
    let website = '';
    let address = '';
    let city = '';
    let region = '';
    let country = defaultCountry;
    let timezone = 'America/New_York';
    let notes = '';
    const tags: string[] = [];
    const customFields: Record<string, unknown> = {};

    for (const [csvCol, systemField] of Object.entries(mappings)) {
      if (!systemField || systemField === 'do_not_map') continue;
      const rawVal = row[csvCol];
      if (isDirtyOrEmpty(rawVal)) continue;
      const val = sanitizeCsvValue(rawVal);
      if (!val) continue;

      switch (systemField) {
        case 'full_name':
          fullName = val;
          break;
        case 'first_name':
          firstName = val;
          break;
        case 'last_name':
          lastName = val;
          break;
        case 'company_name':
          company = val;
          break;
        case 'job_title':
          title = val;
          break;
        case 'phone':
          phoneRaw = val;
          break;
        case 'email':
          emailRaw = val;
          break;
        case 'website':
          website = val;
          break;
        case 'address':
          address = val;
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
        case 'notes':
          notes = notes ? `${notes} | ${val}` : val;
          break;
        case 'tags':
          val.split(/[,;|]/).forEach((t) => {
            const clean = t.trim();
            if (clean) tags.push(clean);
          });
          break;
        case 'priority':
          customFields['priority'] = val;
          break;
        case 'custom_fields':
          customFields[csvCol.toLowerCase().replace(/[^a-z0-9]/g, '_')] = val;
          break;
      }
    }

    // Name resolution
    let name = fullName;
    if (!name && (firstName || lastName)) {
      name = [firstName, lastName].filter(Boolean).join(' ').trim();
    }
    if (!name) {
      name = company ? `${company} Contact` : 'Unnamed Lead';
    }

    // Company fallback
    if (!company) {
      company = name !== 'Unnamed Lead' ? `${name}'s Organization` : 'Commercial Account';
    }

    // Phone normalization
    let phoneE164: string | null = null;
    let finalPhone = phoneRaw;
    if (phoneRaw) {
      const phoneNorm = normalizePhone(phoneRaw, country);
      if (phoneNorm.isValid && phoneNorm.e164) {
        phoneE164 = phoneNorm.e164;
        finalPhone = phoneNorm.e164;
      } else {
        errors.push(`Invalid phone number "${phoneRaw}": ${phoneNorm.reason || 'Failed normalization'}`);
      }
    }

    // Email normalization
    let email: string | null = null;
    if (emailRaw) {
      const emailNorm = normalizeEmail(emailRaw);
      if (emailNorm.isValid) {
        email = emailNorm.email;
      } else {
        errors.push(`Invalid email format "${emailRaw}"`);
      }
    }

    // Minimum Rule: Must have at least ONE working contact channel (Phone or Email)
    if (!phoneE164 && !email) {
      errors.push('Lead requires at least one contact channel (valid Phone number or Email address).');
    }

    // If website is present, append to notes if not already there
    if (website && !notes.includes(website)) {
      notes = notes ? `${notes} | Website: ${website}` : `Website: ${website}`;
    }
    if (address && !notes.includes(address)) {
      notes = notes ? `${notes} | Address: ${address}` : `Address: ${address}`;
    }

    const isValid = errors.length === 0;

    return {
      rowNumber,
      raw: row,
      name,
      firstName,
      lastName,
      company,
      title: title || 'Decision Maker',
      phone: finalPhone,
      phoneE164,
      email,
      website: website || null,
      address: address || null,
      city: city || null,
      region: region || null,
      country,
      timezone,
      notes: notes || null,
      tags,
      customFields,
      isValid,
      errors,
      isDuplicate: false,
    };
  });
}

/**
 * Intelligent Deduplication:
 * 1. Intra-file deduplication (within the uploaded CSV)
 * 2. Database deduplication (against existing Supabase leads)
 * Explains exact duplicate reason for every row.
 */
export function detectDuplicatesAndDnc(
  rows: NormalizedImportRow[],
  existingLeads: LeadRow[] = []
): {
  annotatedRows: NormalizedImportRow[];
  duplicateCount: number;
  intraFileDuplicates: number;
  existingDuplicates: number;
  dncCount: number;
  problemRows: ImportProblemRow[];
} {
  // Existing database index
  const dbPhoneMap = new Map<string, LeadRow>();
  const dbEmailMap = new Map<string, LeadRow>();
  const dbCompanyContactMap = new Map<string, LeadRow>();

  for (const lead of existingLeads) {
    const rawPhone = lead.phone;
    if (rawPhone) {
      dbPhoneMap.set(rawPhone.trim(), lead);
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length >= 7) dbPhoneMap.set(digits, lead);
    }
    if (lead.email) {
      dbEmailMap.set(lead.email.toLowerCase().trim(), lead);
    }
    const cleanName = (lead.name || '').trim().toLowerCase();
    const cleanCompany = (lead.company || '').trim().toLowerCase();
    if (cleanName && cleanCompany && cleanCompany !== 'commercial account') {
      dbCompanyContactMap.set(`${cleanName}|${cleanCompany}`, lead);
    }
  }

  // Batch index for intra-CSV deduplication
  const batchPhoneMap = new Map<string, number>(); // digits/phone -> first rowNumber
  const batchEmailMap = new Map<string, number>(); // email -> first rowNumber
  const batchCompanyContactMap = new Map<string, number>(); // name|company -> first rowNumber

  let intraFileDuplicates = 0;
  let existingDuplicates = 0;
  let dncCount = 0;
  const problemRows: ImportProblemRow[] = [];

  const annotatedRows = rows.map((row) => {
    // 1. Record validation issues if invalid
    if (!row.isValid) {
      problemRows.push({
        rowNumber: row.rowNumber,
        name: row.name,
        company: row.company,
        phone: row.phone || 'None',
        email: row.email || 'None',
        issueType: 'invalid_data',
        issue: 'Invalid Lead Record',
        details: row.errors.join('; '),
      });
      return row;
    }

    const cleanEmail = row.email ? row.email.toLowerCase().trim() : null;
    const rawPhone = row.phone ? row.phone.trim() : null;
    const phoneDigits = rawPhone ? rawPhone.replace(/\D/g, '') : null;
    const cleanName = row.name.toLowerCase().trim();
    const cleanCompany = row.company.toLowerCase().trim();
    const contactKey = `${cleanName}|${cleanCompany}`;

    // 2. Check Intra-CSV Duplicates (Repeated within same upload file)
    let intraDupReason: string | null = null;
    if (cleanEmail && batchEmailMap.has(cleanEmail)) {
      intraDupReason = `Duplicate email (${row.email}) matches row ${batchEmailMap.get(cleanEmail)}`;
    } else if (phoneDigits && phoneDigits.length >= 7 && batchPhoneMap.has(phoneDigits)) {
      intraDupReason = `Duplicate phone (${row.phone}) matches row ${batchPhoneMap.get(phoneDigits)}`;
    } else if (cleanCompany !== 'commercial account' && batchCompanyContactMap.has(contactKey)) {
      intraDupReason = `Duplicate contact & company (${row.name} at ${row.company}) matches row ${batchCompanyContactMap.get(contactKey)}`;
    }

    if (intraDupReason) {
      intraFileDuplicates++;
      problemRows.push({
        rowNumber: row.rowNumber,
        name: row.name,
        company: row.company,
        phone: row.phone || 'None',
        email: row.email || 'None',
        issueType: 'duplicate_csv',
        issue: 'Duplicate in Upload File',
        details: intraDupReason,
      });

      return {
        ...row,
        isDuplicate: true,
        duplicateType: 'intra_csv' as const,
        duplicateReason: intraDupReason,
      };
    }

    // 3. Check Database Duplicates (Matches existing lead in Supabase)
    let dbMatch: LeadRow | undefined;
    let dbDupReason: string | null = null;

    if (cleanEmail && dbEmailMap.has(cleanEmail)) {
      dbMatch = dbEmailMap.get(cleanEmail);
      dbDupReason = `Email matches existing lead "${dbMatch?.name || 'Contact'}" (${dbMatch?.company || 'Company'}) in system.`;
    } else if (rawPhone && dbPhoneMap.has(rawPhone)) {
      dbMatch = dbPhoneMap.get(rawPhone);
      dbDupReason = `Phone number matches existing lead "${dbMatch?.name || 'Contact'}" (${dbMatch?.company || 'Company'}) in system.`;
    } else if (phoneDigits && phoneDigits.length >= 7 && dbPhoneMap.has(phoneDigits)) {
      dbMatch = dbPhoneMap.get(phoneDigits);
      dbDupReason = `Phone number digits match existing lead "${dbMatch?.name || 'Contact'}" in system.`;
    } else if (cleanCompany !== 'commercial account' && dbCompanyContactMap.has(contactKey)) {
      dbMatch = dbCompanyContactMap.get(contactKey);
      dbDupReason = `Contact name & company match existing lead in system.`;
    }

    if (dbMatch) {
      existingDuplicates++;
      const isExistingDnc = Boolean(dbMatch.do_not_call);
      if (isExistingDnc) {
        dncCount++;
        problemRows.push({
          rowNumber: row.rowNumber,
          name: row.name,
          company: row.company,
          phone: row.phone || 'None',
          email: row.email || 'None',
          issueType: 'dnc_protected',
          issue: 'Do Not Call Protected',
          details: `Matches existing lead marked Do Not Call in database.`,
        });
      } else {
        problemRows.push({
          rowNumber: row.rowNumber,
          name: row.name,
          company: row.company,
          phone: row.phone || 'None',
          email: row.email || 'None',
          issueType: 'duplicate_database',
          issue: 'Existing Lead in Database',
          details: dbDupReason || 'Already exists in system.',
        });
      }

      return {
        ...row,
        isDuplicate: true,
        duplicateType: 'existing_database' as const,
        duplicateReason: dbDupReason || 'Already exists in system.',
        matchedExistingLeadId: dbMatch.id,
        isExistingDnc,
      };
    }

    // 4. Register in batch index for subsequent row checks
    if (cleanEmail) batchEmailMap.set(cleanEmail, row.rowNumber);
    if (phoneDigits && phoneDigits.length >= 7) batchPhoneMap.set(phoneDigits, row.rowNumber);
    if (cleanCompany !== 'commercial account') batchCompanyContactMap.set(contactKey, row.rowNumber);

    return row;
  });

  const duplicateCount = intraFileDuplicates + existingDuplicates;

  return {
    annotatedRows,
    duplicateCount,
    intraFileDuplicates,
    existingDuplicates,
    dncCount,
    problemRows,
  };
}

/**
 * Generates downloadable error CSV content for failed, duplicate, or rejected rows.
 */
export function generateErrorCsv(problemRows: ImportProblemRow[]): string {
  const headers = ['Row Number', 'Status / Category', 'Issue Summary', 'Detailed Explanation', 'Contact Name', 'Company', 'Phone', 'Email'];
  const lines = [headers.join(',')];

  for (const p of problemRows) {
    const escape = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    lines.push([
      p.rowNumber,
      escape(p.issueType),
      escape(p.issue),
      escape(p.details),
      escape(p.name),
      escape(p.company),
      escape(p.phone),
      escape(p.email),
    ].join(','));
  }

  return lines.join('\r\n');
}

export interface DatabaseOperations {
  toInsert: LeadInsert[];
  toUpdate: { id: string; updates: LeadUpdate }[];
  skippedCount: number;
}

export function buildDatabaseOperations(
  rows: NormalizedImportRow[],
  existingCandidates: LeadRow[],
  strategy: DuplicateStrategy,
  orgId: string
): DatabaseOperations {
  const toInsert: LeadInsert[] = [];
  const toUpdate: { id: string; updates: LeadUpdate }[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    if (!row.isValid) continue;

    if (row.isDuplicate) {
      if (strategy === 'skip') {
        skippedCount++;
        continue;
      }

      if (strategy === 'overwrite' && row.matchedExistingLeadId) {
        toUpdate.push({
          id: row.matchedExistingLeadId,
          updates: {
            first_name: row.firstName || undefined,
            last_name: row.lastName || undefined,
            company_name: row.company || undefined,
            job_title: row.title || undefined,
            phone: row.phone || undefined,
            phone_e164: row.phoneE164 || undefined,
            email: row.email || undefined,
            city: row.city || undefined,
            region: row.region || undefined,
            country: row.country || undefined,
          },
        });
        continue;
      }

      if (strategy === 'update_missing' && row.matchedExistingLeadId) {
        const existing = existingCandidates.find((l) => l.id === row.matchedExistingLeadId);
        const updates: LeadUpdate = {};
        if (existing) {
          if (!existing.email && row.email) updates.email = row.email;
          if (!existing.phone && row.phone) {
            updates.phone = row.phone;
            updates.phone_e164 = row.phoneE164 || undefined;
          }
          if (!existing.city && row.city) updates.city = row.city;
          if (!existing.company && row.company) updates.company_name = row.company;
        }
        toUpdate.push({ id: row.matchedExistingLeadId, updates });
        continue;
      }

      skippedCount++;
      continue;
    }

    toInsert.push({
      organization_id: orgId,
      first_name: row.firstName,
      last_name: row.lastName,
      company_name: row.company,
      job_title: row.title,
      phone: row.phone,
      phone_e164: row.phoneE164 || row.phone,
      email: row.email,
      country: row.country,
      region: row.region || null,
      city: row.city || null,
      timezone: row.timezone,
      source: 'csv_import',
      status: 'new',
      priority: 'medium',
      is_dnc: false,
      dnc_reason: null,
      custom_fields: (row.customFields || {}) as Json,
    });
  }

  return { toInsert, toUpdate, skippedCount };
}
