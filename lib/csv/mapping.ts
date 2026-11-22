/**
 * RM AI DIALER - DYNAMIC CSV HEADER DETECTION & MAPPING
 * Maps arbitrary CSV column names to standardized RM Lead fields.
 */

export type RmSystemField =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'company_name'
  | 'job_title'
  | 'phone'
  | 'email'
  | 'country'
  | 'region'
  | 'city'
  | 'timezone'
  | 'status'
  | 'priority'
  | 'fleet_size'
  | 'tags'
  | 'notes'
  | 'custom_fields'
  | 'do_not_map';

export interface FieldDefinition {
  id: RmSystemField;
  label: string;
  category: 'core' | 'contact' | 'geo' | 'meta' | 'action';
  isRequired?: boolean;
}

export const RM_FIELD_DEFINITIONS: FieldDefinition[] = [
  { id: 'first_name', label: 'First Name', category: 'core' },
  { id: 'last_name', label: 'Last Name', category: 'core' },
  { id: 'company_name', label: 'Company', category: 'core', isRequired: true },
  { id: 'job_title', label: 'Job Title', category: 'core' },
  { id: 'phone', label: 'Phone', category: 'contact', isRequired: true },
  { id: 'email', label: 'Email', category: 'contact' },
  { id: 'country', label: 'Country', category: 'geo' },
  { id: 'city', label: 'City', category: 'geo' },
  { id: 'status', label: 'Status', category: 'core' },
  { id: 'priority', label: 'Priority', category: 'core' },
  { id: 'tags', label: 'Tags', category: 'meta' },
  { id: 'notes', label: 'Notes', category: 'meta' },
  { id: 'custom_fields', label: 'Custom Field', category: 'meta' },
  { id: 'do_not_map', label: 'Ignore', category: 'action' },
];

/**
 * Common column alias dictionary for fuzzy / smart header detection.
 */
const ALIAS_DICTIONARY: Record<RmSystemField, string[]> = {
  first_name: [
    'first_name', 'firstname', 'first', 'given_name', 'givenname', 'contact_first_name',
    'fname', 'forename', 'first name',
  ],
  last_name: [
    'last_name', 'lastname', 'last', 'surname', 'family_name', 'familyname',
    'lname', 'last name',
  ],
  full_name: [
    'full_name', 'fullname', 'name', 'contact_name', 'lead_name', 'prospect_name',
    'contact', 'prospect', 'person', 'full name',
  ],
  company_name: [
    'company_name', 'company', 'companyname', 'organization', 'organisation', 'business',
    'business_name', 'firm', 'carrier', 'shipper', 'broker', 'org', 'account', 'company name',
  ],
  job_title: [
    'job_title', 'jobtitle', 'title', 'role', 'position', 'occupation', 'designation',
    'job title',
  ],
  phone: [
    'phone', 'phone_number', 'phonenumber', 'mobile', 'telephone', 'tel', 'cell',
    'cell_phone', 'work_phone', 'direct_phone', 'contact_phone', 'phone_e164', 'phone number',
  ],
  email: [
    'email', 'email_address', 'emailaddress', 'mail', 'e-mail', 'contact_email',
    'work_email', 'primary_email', 'email address',
  ],
  city: ['city', 'town', 'municipality', 'locality'],
  region: ['region', 'state', 'province', 'territory', 'county', 'st'],
  country: ['country', 'nation', 'country_code', 'countrycode', 'cntry'],
  timezone: ['timezone', 'time_zone', 'tz', 'calling_timezone', 'local_timezone'],
  status: ['status', 'lead_status', 'stage', 'state'],
  priority: ['priority', 'lead_priority', 'urgency', 'tier', 'grade'],
  fleet_size: ['fleet_size', 'fleetsize', 'fleet', 'trucks', 'units', 'tractors', 'semi_units', 'fleet size'],
  tags: ['tags', 'tag', 'labels', 'categories', 'segment', 'segments'],
  notes: ['notes', 'note', 'comments', 'comment', 'description', 'remarks'],
  custom_fields: ['custom', 'custom_fields', 'meta', 'attributes', 'extra'],
  do_not_map: ['ignore', 'skip', 'id', 'unmapped'],
};

export interface ColumnMappingResult {
  csvHeader: string;
  systemField: RmSystemField;
  confidence: number; // 0 - 100
  sampleValue?: string;
  statusLabel: string;
}

/**
 * Analyzes CSV headers and samples to suggest optimal system field mappings.
 */
export function autoDetectMappings(
  headers: string[],
  sampleRows: Record<string, string>[] = []
): ColumnMappingResult[] {
  const results: ColumnMappingResult[] = [];
  const assignedFields = new Set<RmSystemField>();

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_').trim();
    const sampleValue = sampleRows.length > 0 ? (sampleRows[0][header] ?? '') : '';

    let bestField: RmSystemField = 'custom_fields';
    let bestConfidence = 0;

    for (const [fieldKey, aliases] of Object.entries(ALIAS_DICTIONARY) as [RmSystemField, string[]][]) {
      if (fieldKey === 'do_not_map' || fieldKey === 'custom_fields') continue;

      // Exact match
      if (normalizedHeader === fieldKey) {
        bestField = fieldKey;
        bestConfidence = 100;
        break;
      }

      // Alias exact match
      if (aliases.includes(normalizedHeader)) {
        bestField = fieldKey;
        bestConfidence = 95;
        break;
      }

      // Partial alias match
      for (const alias of aliases) {
        if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) {
          if (80 > bestConfidence) {
            bestField = fieldKey;
            bestConfidence = 80;
          }
        }
      }
    }

    // Value-based heuristics if confidence is low
    if (bestConfidence < 80 && sampleValue) {
      if (sampleValue.includes('@') && sampleValue.includes('.')) {
        bestField = 'email';
        bestConfidence = 90;
      } else if (/^[\+\d\s\(\)\-]{7,20}$/.test(sampleValue) && (sampleValue.match(/\d/g) || []).length >= 7) {
        bestField = 'phone';
        bestConfidence = 90;
      }
    }

    // Avoid duplicate primary fields (e.g. two full_names)
    if (assignedFields.has(bestField) && bestField !== 'custom_fields') {
      bestField = 'custom_fields';
      bestConfidence = 50;
    } else if (bestConfidence >= 80) {
      assignedFields.add(bestField);
    }

    // Determine readable status label
    let statusLabel = 'Unmapped';
    if (bestConfidence >= 80) statusLabel = 'Matched';
    else if (bestField === 'custom_fields') statusLabel = 'Custom Field';

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
