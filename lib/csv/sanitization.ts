/**
 * RM AI DIALER - CSV FORMULA INJECTION & EXPORT SANITIZATION
 * Protects against CSV / Spreadsheet formula injection attacks (DDE, cmd, eval).
 */

import { isValidE164 } from '@/lib/telephony/phone';

const FORMULA_START_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitizes a cell value to prevent CSV Formula Injection in Excel, Sheets, and Calc.
 * Crucial: Valid E.164 phone numbers (e.g. +14158902104) are NOT altered.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value).trim();
  if (str.length === 0) return '';

  const firstChar = str[0];

  // If starts with '+' and is a legitimate E.164 phone number, keep it as-is!
  if (firstChar === '+' && isValidE164(str)) {
    return str;
  }

  // If starts with a formula trigger character, neutralize it with a single quote prefix
  if (FORMULA_START_CHARS.includes(firstChar)) {
    return `'${str}`;
  }

  return str;
}

/**
 * Escapes a string for safe inclusion in an RFC 4180 CSV export.
 * Wraps values containing commas, double quotes, or newlines in quotes.
 */
export function escapeCsvExportValue(val: unknown): string {
  const sanitized = sanitizeCsvCell(val);
  if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('\r')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}
