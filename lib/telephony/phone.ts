/**
 * RM AI DIALER - TELEPHONY PHONE NORMALIZATION
 * Strict E.164 phone parser, sanitizer, and formatter.
 */

export interface PhoneNormalizationResult {
  raw: string;
  normalized: string;
  e164: string | null;
  isValid: boolean;
  country?: string;
  reason?: string;
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Normalizes an arbitrary phone string into standard E.164 format.
 * Supports international prefix notation (00...), UK local notation (07...),
 * US 10-digit numbers, and common delimiters.
 */
export function normalizePhone(
  rawInput: string | null | undefined,
  defaultCountry: string = 'US'
): PhoneNormalizationResult {
  const raw = String(rawInput ?? '').trim();

  if (!raw) {
    return {
      raw,
      normalized: '',
      e164: null,
      isValid: false,
      reason: 'Phone number cannot be empty',
    };
  }

  // Remove common invisible characters, whitespace, parentheses, hyphens, dots
  let cleaned = raw.replace(/[\s\(\)\-\.\u200B-\u200D\uFEFF]/g, '');

  // 1. Check if starts with international dialing prefix "00" (e.g., 0044 -> +44)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // 2. If starts with '+', validate directly against E.164 rules
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1);
    if (!/^\d+$/.test(digitsOnly)) {
      return {
        raw,
        normalized: cleaned,
        e164: null,
        isValid: false,
        reason: 'Contains non-numeric characters after country code',
      };
    }
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return {
        raw,
        normalized: cleaned,
        e164: null,
        isValid: false,
        reason: `E.164 digit count must be between 7 and 15 digits (got ${digitsOnly.length})`,
      };
    }

    const country = detectCountryFromE164(cleaned);
    return {
      raw,
      normalized: cleaned,
      e164: cleaned,
      isValid: true,
      country,
    };
  }

  // 3. Number does not start with '+' - handle based on digits and country context
  const digits = cleaned.replace(/\D/g, '');

  if (!digits) {
    return {
      raw,
      normalized: '',
      e164: null,
      isValid: false,
      reason: 'No numeric digits found in input',
    };
  }

  const countryUpper = defaultCountry.toUpperCase();

  // US / Canada handling (NANP)
  if (countryUpper === 'US' || countryUpper === 'USA' || countryUpper === 'CA' || countryUpper === 'UNITED STATES') {
    if (digits.length === 10) {
      const e164 = `+1${digits}`;
      return {
        raw,
        normalized: e164,
        e164,
        isValid: true,
        country: 'US',
      };
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      const e164 = `+${digits}`;
      return {
        raw,
        normalized: e164,
        e164,
        isValid: true,
        country: 'US',
      };
    }
  }

  // United Kingdom handling (UK / GB)
  if (countryUpper === 'UK' || countryUpper === 'GB' || countryUpper === 'UNITED KINGDOM') {
    // UK local mobile starts with 07 (e.g. 07123456789 -> +447123456789)
    if (digits.length === 11 && digits.startsWith('0')) {
      const e164 = `+44${digits.slice(1)}`;
      return {
        raw,
        normalized: e164,
        e164,
        isValid: true,
        country: 'GB',
      };
    }
    if (digits.length === 12 && digits.startsWith('44')) {
      const e164 = `+${digits}`;
      return {
        raw,
        normalized: e164,
        e164,
        isValid: true,
        country: 'GB',
      };
    }
  }

  // Australia handling (AU)
  if (countryUpper === 'AU' || countryUpper === 'AUSTRALIA') {
    if (digits.length === 10 && digits.startsWith('0')) {
      const e164 = `+61${digits.slice(1)}`;
      return {
        raw,
        normalized: e164,
        e164,
        isValid: true,
        country: 'AU',
      };
    }
  }

  // Default fallback: If 10 digits and default country is US, treat as US standard
  if (digits.length === 10) {
    const e164 = `+1${digits}`;
    return {
      raw,
      normalized: e164,
      e164,
      isValid: true,
      country: 'US',
    };
  }

  // If already 11 digits starting with 1, assume US
  if (digits.length === 11 && digits.startsWith('1')) {
    const e164 = `+${digits}`;
    return {
      raw,
      normalized: e164,
      e164,
      isValid: true,
      country: 'US',
    };
  }

  // If ambiguous without country code, do not invent country code silently
  return {
    raw,
    normalized: digits,
    e164: null,
    isValid: false,
    reason: `Ambiguous local format (${digits.length} digits) without explicit country code or prefix`,
  };
}

/**
 * Validates if a string is strictly E.164 compliant.
 */
export function isValidE164(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return E164_REGEX.test(phone.trim());
}

/**
 * Formats an E.164 phone number into clean presentation format for UI.
 * e.g. +14158902104 -> +1 (415) 890-2104
 */
export function formatDisplayPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.startsWith('+1') && clean.length === 12) {
    return `+1 (${clean.slice(2, 5)}) ${clean.slice(5, 8)}-${clean.slice(8)}`;
  }
  if (clean.startsWith('+44') && clean.length === 13) {
    return `+44 ${clean.slice(3, 7)} ${clean.slice(7)}`;
  }
  return clean;
}

function detectCountryFromE164(e164: string): string {
  if (e164.startsWith('+1')) return 'US';
  if (e164.startsWith('+44')) return 'GB';
  if (e164.startsWith('+61')) return 'AU';
  if (e164.startsWith('+49')) return 'DE';
  if (e164.startsWith('+33')) return 'FR';
  if (e164.startsWith('+81')) return 'JP';
  return 'International';
}
