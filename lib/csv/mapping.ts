/**
 * 80/20 AI DIALER - DYNAMIC CSV HEADER DETECTION & RECOGNITION
 * Automatically maps arbitrary CSV columns to standardized Lead fields.
 * Incorporates fuzzy alias matching, camelCase/hyphen normalization,
 * and value-based heuristics. High confidence (>80%) columns are auto-mapped;
 * low confidence (<80%) columns require manual review.
 */

export type RmSystemField =
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'company_name'
  | 'job_title'
  | 'phone'
  | 'email'
  | 'website'
  | 'address'
  | 'city'
  | 'region'
  | 'country'
  | 'timezone'
  | 'notes'
  | 'tags'
  | 'priority'
  | 'custom_fields'
  | 'do_not_map';

export interface FieldDefinition {
  id: RmSystemField;
  label: string;
  category: 'core' | 'contact' | 'geo' | 'meta' | 'action';
  isRequired?: boolean;
  description?: string;
}

export const RM_FIELD_DEFINITIONS: FieldDefinition[] = [
  { id: 'company_name', label: 'Company / Business Name', category: 'core', isRequired: true, description: 'Organization or firm name' },
  { id: 'full_name', label: 'Contact Name / Full Name', category: 'core', description: 'Full name of the contact' },
  { id: 'first_name', label: 'First Name', category: 'core', description: 'First or given name' },
  { id: 'last_name', label: 'Last Name', category: 'core', description: 'Last or family surname' },
  { id: 'phone', label: 'Phone Number', category: 'contact', isRequired: true, description: 'Mobile, direct, or business phone' },
  { id: 'email', label: 'Email Address', category: 'contact', description: 'Work or personal email address' },
  { id: 'job_title', label: 'Job Title / Position', category: 'core', description: 'Role, title, or occupation' },
  { id: 'website', label: 'Website URL', category: 'core', description: 'Company or business website URL' },
  { id: 'address', label: 'Street Address', category: 'geo', description: 'Physical or mailing street address' },
  { id: 'city', label: 'City', category: 'geo', description: 'City or municipality' },
  { id: 'region', label: 'State / Region', category: 'geo', description: 'State, province, or territory' },
  { id: 'country', label: 'Country', category: 'geo', description: 'Country name or 2-letter ISO code' },
  { id: 'timezone', label: 'Timezone', category: 'geo', description: 'Local timezone identifier (e.g. America/New_York)' },
  { id: 'notes', label: 'Notes / Remarks', category: 'meta', description: 'Background notes, commentary, or context' },
  { id: 'tags', label: 'Tags / Categories', category: 'meta', description: 'Segmentation labels or tags' },
  { id: 'priority', label: 'Priority / Score', category: 'meta', description: 'Lead tier, priority, or ranking score' },
  { id: 'custom_fields', label: 'Custom Field', category: 'meta', description: 'Preserved as custom metadata' },
  { id: 'do_not_map', label: '— Ignore Column —', category: 'action', description: 'Exclude this column from the import' },
];

/**
 * Normalizes an arbitrary header string for reliable matching.
 * Converts camelCase, strips BOM, replaces delimiters with underscores.
 */
export function normalizeHeader(rawHeader: string): string {
  if (!rawHeader || typeof rawHeader !== 'string') return '';

  return rawHeader
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s\-\.\/\\]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const normalizeHeaderName = normalizeHeader;

/**
 * Centralized CSV Field Alias & Canonical Mapping Configuration.
 * Derived from production 8020 Dialer & CRM schemas.
 */
const ALIAS_DICTIONARY: Record<RmSystemField, string[]> = {
  full_name: [
    'full_name', 'fullname', 'name', 'contact_name', 'contactname', 'lead_name',
    'leadname', 'prospect_name', 'contact', 'prospect', 'person', 'customer_name',
    'client_name', 'contact_person', 'owner_name', 'owner', 'lead_owner', 'full name',
    'contact name', 'lead name', 'person name',
  ],
  first_name: [
    'first_name', 'firstname', 'first', 'given_name', 'givenname', 'contact_first_name',
    'fname', 'forename', 'first name', 'contact first name',
  ],
  last_name: [
    'last_name', 'lastname', 'last', 'surname', 'family_name', 'familyname',
    'lname', 'last name', 'contact last name',
  ],
  company_name: [
    'company_name', 'company', 'companyname', 'organization', 'organisation', 'business',
    'business_name', 'firm', 'carrier', 'shipper', 'broker', 'org', 'account',
    'account_name', 'employer', 'agency', 'company name', 'business name', 'org name',
  ],
  job_title: [
    'job_title', 'jobtitle', 'title', 'role', 'position', 'occupation', 'designation',
    'profession', 'job title', 'contact_title', 'lead_title',
  ],
  phone: [
    'phone', 'phone_number', 'phonenumber', 'mobile', 'mobile_number', 'telephone',
    'tel', 'cell', 'cell_phone', 'cellphone', 'work_phone', 'direct_phone',
    'contact_phone', 'contact_number', 'phone_1', 'primary_phone', 'phone_e164',
    'phone number', 'mobile phone', 'cell phone', 'business phone',
  ],
  email: [
    'email', 'email_address', 'emailaddress', 'mail', 'e-mail', 'e_mail',
    'contact_email', 'work_email', 'primary_email', 'business_email', 'email address',
  ],
  website: [
    'website', 'company_website', 'companywebsite', 'domain', 'url', 'web',
    'site', 'homepage', 'business_website', 'business_url', 'company_url',
    'website_url', 'web_address', 'company link',
  ],
  address: [
    'address', 'street', 'street_address', 'streetaddress', 'address_line_1',
    'addr', 'location', 'street address',
  ],
  city: ['city', 'town', 'municipality', 'locality'],
  region: ['region', 'state', 'province', 'territory', 'county', 'st', 'state_province'],
  country: ['country', 'nation', 'country_code', 'countrycode', 'cntry', 'country_name'],
  timezone: ['timezone', 'time_zone', 'tz', 'calling_timezone', 'local_timezone'],
  notes: ['notes', 'note', 'comments', 'comment', 'description', 'remarks', 'memo', 'details'],
  tags: ['tags', 'tag', 'labels', 'categories', 'segment', 'segments', 'lead_tags'],
  priority: ['priority', 'lead_priority', 'urgency', 'tier', 'grade', 'rank', 'score', 'lead_score'],
  custom_fields: ['custom', 'custom_fields', 'meta', 'attributes', 'extra'],
  do_not_map: ['ignore', 'skip', 'id', 'unmapped', 'lead_id', 'contact_id', 'sys_id', 'row_id', 'created_at', 'updated_at'],
};

export interface ColumnMappingResult {
  csvHeader: string;
  systemField: RmSystemField;
  confidence: number; // 0 - 100
  sampleValue?: string;
  statusLabel: string;
}

/**
 * Analyzes CSV headers and sample data to identify the best system field.
 * Strict confidence threshold: Low confidence (<80%) is not automatically assigned
 * and is instead marked as "Requires Manual Review" to avoid silent misassignments.
 */
export function autoDetectMappings(
  headers: string[],
  sampleRows: Record<string, string>[] = []
): ColumnMappingResult[] {
  const results: ColumnMappingResult[] = [];
  const assignedFields = new Set<RmSystemField>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const sampleValue = sampleRows.length > 0 ? (sampleRows[0][header] ?? '').trim() : '';

    let bestField: RmSystemField = 'do_not_map';
    let bestConfidence = 0;

    for (const [fieldKey, aliases] of Object.entries(ALIAS_DICTIONARY) as [RmSystemField, string[]][]) {
      if (fieldKey === 'do_not_map' || fieldKey === 'custom_fields') continue;

      // 1. Exact canonical name match
      if (normalized === fieldKey) {
        bestField = fieldKey;
        bestConfidence = 100;
        break;
      }

      // 2. Exact alias match
      if (aliases.includes(normalized)) {
        bestField = fieldKey;
        bestConfidence = 95;
        break;
      }

      // 3. Partial alias match
      for (const alias of aliases) {
        if (normalized.includes(alias) || alias.includes(normalized)) {
          if (80 > bestConfidence) {
            bestField = fieldKey;
            bestConfidence = 80;
          }
        }
      }
    }

    // 4. Content-based heuristics for untyped or ambiguous headers
    if (bestConfidence < 80 && sampleValue) {
      if (sampleValue.includes('@') && sampleValue.includes('.')) {
        bestField = 'email';
        bestConfidence = 90;
      } else if (/^[\+\d\s\(\)\-]{7,22}$/.test(sampleValue) && (sampleValue.match(/\d/g) || []).length >= 7) {
        bestField = 'phone';
        bestConfidence = 90;
      } else if (/^https?:\/\//i.test(sampleValue) || /^www\./i.test(sampleValue)) {
        bestField = 'website';
        bestConfidence = 90;
      }
    }

    // 5. Enforce single assignment for core unique columns
    const UNIQUE_CORE_FIELDS: RmSystemField[] = ['phone', 'email', 'company_name', 'full_name', 'first_name', 'last_name'];
    if (UNIQUE_CORE_FIELDS.includes(bestField) && assignedFields.has(bestField)) {
      bestField = 'do_not_map';
      bestConfidence = 40;
    } else if (bestConfidence >= 80) {
      assignedFields.add(bestField);
    }

    // 6. Low-confidence guardrail: Never silently guess an uncertain column
    let statusLabel = 'Requires Review';
    if (bestConfidence >= 95) {
      statusLabel = 'Matched (High Confidence)';
    } else if (bestConfidence >= 80) {
      statusLabel = 'Matched (Probable)';
    } else {
      bestField = 'do_not_map';
      bestConfidence = Math.max(bestConfidence, 30);
      statusLabel = 'Requires Manual Review';
    }

    results.push({
      csvHeader: header,
      systemField: bestField,
      confidence: bestConfidence,
      sampleValue,
      statusLabel,
    });
  }

  return results;
}
