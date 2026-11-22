/**
 * 80/20 AI DIALER — COMPREHENSIVE CSV IMPORT & LEAD DETECTION TEST SUITE
 * Validates RFC 4180 parsing, intelligent column detection, dirty data sanitization,
 * formula injection prevention, intra-CSV deduplication, Supabase duplicate matching,
 * DNC immutability, and downloadable error CSV generation.
 */

import assert from 'assert';
import { parseCsv } from '../lib/csv/parser';
import { autoDetectMappings, normalizeHeaderName } from '../lib/csv/mapping';
import {
  normalizeCsvRows,
  detectDuplicatesAndDnc,
  buildDatabaseOperations,
  generateErrorCsv,
  isDirtyOrEmpty,
  sanitizeCsvValue,
  normalizeEmail,
} from '../lib/csv/importer';
import type { LeadRow } from '../repositories/leads.repository';

console.log('======================================================================');
console.log('80/20 AI DIALER — CSV UPLOAD & INTELLIGENT LEAD DETECTION TEST SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res && typeof (res as Promise<void>).then === 'function') {
      return (res as Promise<void>)
        .then(() => {
          console.log(`  [PASS] ${name}`);
          passed++;
        })
        .catch((err) => {
          console.error(`  [FAIL] ${name}`);
          console.error(`         ${err.message}`);
          failed++;
        });
    }
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: unknown) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

async function runAll() {
  // -------------------------------------------------------------------------
  // 1. RFC 4180 & CSV PARSER RIGOR
  // -------------------------------------------------------------------------
  console.log('--- 1. RFC 4180 & DELIMITER PARSING ---');

  test('Parses standard comma-delimited CSV with headers', () => {
    const csv = 'Name,Phone,Email\nJohn Doe,+14155552671,john@acme.com';
    const result = parseCsv(csv);
    assert.strictEqual(result.headers.length, 3);
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].Name, 'John Doe');
    assert.strictEqual(result.rows[0].Phone, '+14155552671');
    assert.strictEqual(result.rows[0].Email, 'john@acme.com');
  });

  test('Autodetects tab-separated values (TSV)', () => {
    const tsv = 'Company\tContact\tTelephone\nPrimeFreight\tMarcus Brody\t+14158902104';
    const result = parseCsv(tsv);
    assert.strictEqual(result.delimiter, '\t');
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].Company, 'PrimeFreight');
    assert.strictEqual(result.rows[0].Contact, 'Marcus Brody');
  });

  test('Autodetects semicolon-delimited CSV', () => {
    const ssv = 'Nom;Societe;Telephone\nPierre;Acme SAS;+33140506070';
    const result = parseCsv(ssv);
    assert.strictEqual(result.delimiter, ';');
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].Nom, 'Pierre');
  });

  test('Autodetects pipe-delimited CSV', () => {
    const psv = 'Name|Company|Phone\nAlice|Global Logistics|+12145550144';
    const result = parseCsv(psv);
    assert.strictEqual(result.delimiter, '|');
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].Name, 'Alice');
  });

  test('Strips UTF-8 BOM (\\uFEFF) without corrupting the first header', () => {
    const bomCsv = '\uFEFFFull Name,Phone,Email\nElena Rostova,+13124029981,elena@titan.com';
    const result = parseCsv(bomCsv);
    assert.strictEqual(result.headers[0], 'Full Name');
    assert.strictEqual(result.rows[0]['Full Name'], 'Elena Rostova');
  });

  test('Handles quoted values containing commas inside fields', () => {
    const quoted = 'Company,Contact,Address\n"Prime Logistics, LLC",David Vance,"123 Ocean Ave, Suite 400"';
    const result = parseCsv(quoted);
    assert.strictEqual(result.rows[0].Company, 'Prime Logistics, LLC');
    assert.strictEqual(result.rows[0].Contact, 'David Vance');
    assert.strictEqual(result.rows[0].Address, '123 Ocean Ave, Suite 400');
  });

  test('Handles escaped double quotes ("") within quoted fields', () => {
    const escaped = 'Note,Author\n"Said ""Call back tomorrow"" at 3pm",Alex';
    const result = parseCsv(escaped);
    assert.strictEqual(result.rows[0].Note, 'Said "Call back tomorrow" at 3pm');
    assert.strictEqual(result.rows[0].Author, 'Alex');
  });

  test('Handles multiline records with embedded newlines within quotes', () => {
    const multiline = 'Name,Notes,Phone\nJohn Doe,"First line\nSecond line\nThird line",+14155552671';
    const result = parseCsv(multiline);
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].Name, 'John Doe');
    assert.strictEqual(result.rows[0].Notes, 'First line\nSecond line\nThird line');
    assert.strictEqual(result.rows[0].Phone, '+14155552671');
  });

  test('Skips blank and whitespace-only lines without creating phantom leads', () => {
    const csvWithBlanks = 'Name,Phone\nJohn,+14155552671\n   \n\n\nJane,+13124029981\n   \t  \n';
    const result = parseCsv(csvWithBlanks);
    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.rows[0].Name, 'John');
    assert.strictEqual(result.rows[1].Name, 'Jane');
  });

  // -------------------------------------------------------------------------
  // 2. INTELLIGENT COLUMN DETECTION & HEADER NORMALIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- 2. INTELLIGENT COLUMN DETECTION & ALIASES ---');

  test('Normalizes diverse header variations correctly', () => {
    assert.strictEqual(normalizeHeaderName('First Name'), 'first_name');
    assert.strictEqual(normalizeHeaderName('work_phone'), 'work_phone');
    assert.strictEqual(normalizeHeaderName('Direct-Email-Address'), 'direct_email_address');
    assert.strictEqual(normalizeHeaderName('Company / Organisation'), 'company_organisation');
  });

  test('Auto-maps standard CRM columns with high confidence (>=80%)', () => {
    const headers = ['Full Name', 'Work Phone', 'Company Name', 'Direct Email', 'Job Title', 'City', 'Country'];
    const sampleRows = [
      {
        'Full Name': 'Marcus Brody',
        'Work Phone': '+1 415 890 2104',
        'Company Name': 'PrimeFreight Inc',
        'Direct Email': 'm.brody@primefreight.io',
        'Job Title': 'VP Operations',
        'City': 'San Francisco',
        'Country': 'US',
      },
    ];

    const detected = autoDetectMappings(headers, sampleRows);
    const mapDict = Object.fromEntries(detected.map((d) => [d.csvHeader, d.systemField]));

    assert.strictEqual(mapDict['Full Name'], 'full_name');
    assert.strictEqual(mapDict['Work Phone'], 'phone');
    assert.strictEqual(mapDict['Company Name'], 'company_name');
    assert.strictEqual(mapDict['Direct Email'], 'email');
    assert.strictEqual(mapDict['Job Title'], 'job_title');
    assert.strictEqual(mapDict['City'], 'city');
    assert.strictEqual(mapDict['Country'], 'country');

    // All should have high confidence >= 80%
    for (const d of detected) {
      assert.ok(d.confidence >= 80, `Expected confidence >= 80 for ${d.csvHeader}, got ${d.confidence}`);
      assert.ok(d.statusLabel.startsWith('Matched'));
    }
  });

  test('Auto-maps split First Name and Last Name columns', () => {
    const headers = ['FirstName', 'LastName', 'Mobile', 'Organization'];
    const sampleRows = [
      { FirstName: 'Sarah', LastName: 'Connor', Mobile: '4155552671', Organization: 'Cyberdyne Systems' },
    ];
    const detected = autoDetectMappings(headers, sampleRows);
    const mapDict = Object.fromEntries(detected.map((d) => [d.csvHeader, d.systemField]));

    assert.strictEqual(mapDict['FirstName'], 'first_name');
    assert.strictEqual(mapDict['LastName'], 'last_name');
    assert.strictEqual(mapDict['Mobile'], 'phone');
    assert.strictEqual(mapDict['Organization'], 'company_name');
  });

  test('Marks ambiguous/unknown columns (<80% confidence) for manual review', () => {
    const headers = ['Internal Tracking ID', 'Random Column 99'];
    const sampleRows = [{ 'Internal Tracking ID': 'TRK-9872', 'Random Column 99': 'XYZ' }];
    const detected = autoDetectMappings(headers, sampleRows);

    for (const d of detected) {
      assert.strictEqual(d.systemField, 'do_not_map');
      assert.strictEqual(d.statusLabel, 'Requires Manual Review');
      assert.ok(d.confidence < 80, `Expected confidence < 80, got ${d.confidence}`);
    }
  });

  // -------------------------------------------------------------------------
  // 3. SANITIZATION & SPREADSHEET FORMULA INJECTION PREVENTION
  // -------------------------------------------------------------------------
  console.log('\n--- 3. DATA SANITIZATION & FORMULA INJECTION PROTECTION ---');

  test('Filters dirty placeholders (n/a, unknown, none, -, null) to empty strings', () => {
    assert.strictEqual(isDirtyOrEmpty('n/a'), true);
    assert.strictEqual(isDirtyOrEmpty('N/A'), true);
    assert.strictEqual(isDirtyOrEmpty('unknown'), true);
    assert.strictEqual(isDirtyOrEmpty('none'), true);
    assert.strictEqual(isDirtyOrEmpty('-'), true);
    assert.strictEqual(isDirtyOrEmpty('--'), true);
    assert.strictEqual(isDirtyOrEmpty('nil'), true);
    assert.strictEqual(isDirtyOrEmpty(''), true);
    assert.strictEqual(isDirtyOrEmpty('Valid Value'), false);
  });

  test('Neutralizes spreadsheet formula injection (=, @, +, -)', () => {
    assert.strictEqual(sanitizeCsvValue('=cmd|/C calc!A0'), "'=cmd|/C calc!A0");
    assert.strictEqual(sanitizeCsvValue('@SUM(1,2)'), "'@SUM(1,2)");
    assert.strictEqual(sanitizeCsvValue('-5+5'), "'-5+5");

    // Legitimate international phone number starting with + must NOT be prepended with quote
    assert.strictEqual(sanitizeCsvValue('+14155552671'), '+14155552671');
    assert.strictEqual(sanitizeCsvValue('+1 415 890 2104'), '+1 415 890 2104');
  });

  test('Normalizes emails (lowercasing, trimming whitespace, regex format)', () => {
    assert.strictEqual(normalizeEmail('  JOHN.DOE@ACME.COM  ').email, 'john.doe@acme.com');
    assert.strictEqual(normalizeEmail('invalid-email-no-at').isValid, false);
    assert.strictEqual(normalizeEmail('missing-domain@').isValid, false);
    assert.strictEqual(normalizeEmail('n/a').email, null);
    assert.strictEqual(normalizeEmail('n/a').isValid, true);
  });

  // -------------------------------------------------------------------------
  // 4. PHONE NORMALIZATION & MINIMUM CONTACT VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. PHONE NORMALIZATION & MINIMUM CONTACT RULE ---');

  test('Normalizes various US phone formats to E.164 without losing data', () => {
    const rawRows = [
      { Phone: '(415) 890-2104', Name: 'Lead 1' },
      { Phone: '415.890.2104', Name: 'Lead 2' },
      { Phone: '4158902104', Name: 'Lead 3' },
      { Phone: '+1 415 890 2104', Name: 'Lead 4' },
    ];
    const mappings = { Phone: 'phone' as const, Name: 'full_name' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');

    for (const row of normalized) {
      assert.strictEqual(row.phoneE164, '+14158902104');
      assert.strictEqual(row.isValid, true);
    }
  });

  test('Enforces Minimum Contact Rule: rejects leads missing BOTH phone and email', () => {
    const rawRows = [
      { Name: 'Valid Phone Only', Phone: '+14155552671', Email: '' },
      { Name: 'Valid Email Only', Phone: '', Email: 'lead@valid.com' },
      { Name: 'Missing Both', Phone: '', Email: '' },
      { Name: 'Invalid Phone & Missing Email', Phone: '123', Email: '' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');

    assert.strictEqual(normalized[0].isValid, true);
    assert.strictEqual(normalized[1].isValid, true);
    assert.strictEqual(normalized[2].isValid, false);
    assert.ok(normalized[2].errors.some((e) => e.includes('at least one contact channel')));
    assert.strictEqual(normalized[3].isValid, false);
  });

  test('Supports multi-field lead detection (notes, website, address, city, country)', () => {
    const rawRows = [
      {
        FullName: 'Alice Johnson',
        Phone: '+14155552671',
        Web: 'https://alicehaul.io',
        Street: '100 Market St',
        Town: 'San Francisco',
        State: 'CA',
        Nation: 'US',
        Memo: 'Key account decision maker',
      },
    ];
    const mappings = {
      FullName: 'full_name' as const,
      Phone: 'phone' as const,
      Web: 'website' as const,
      Street: 'address' as const,
      Town: 'city' as const,
      State: 'region' as const,
      Nation: 'country' as const,
      Memo: 'notes' as const,
    };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const lead = normalized[0];

    assert.strictEqual(lead.name, 'Alice Johnson');
    assert.strictEqual(lead.phoneE164, '+14155552671');
    assert.strictEqual(lead.website, 'https://alicehaul.io');
    assert.strictEqual(lead.address, '100 Market St');
    assert.strictEqual(lead.city, 'San Francisco');
    assert.strictEqual(lead.region, 'CA');
    assert.strictEqual(lead.country, 'US');
    assert.ok(lead.notes?.includes('Key account decision maker'));
    assert.ok(lead.notes?.includes('Website: https://alicehaul.io'));
  });

  // -------------------------------------------------------------------------
  // 5. INTRA-FILE DEDUPLICATION (WITHIN SAME UPLOAD)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. INTRA-FILE DEDUPLICATION ---');

  test('Flags intra-CSV duplicate emails with exact row reference', () => {
    const rawRows = [
      { Name: 'Original', Email: 'alex@carrier.com', Phone: '+14155552671' },
      { Name: 'Duplicate', Email: 'alex@carrier.com', Phone: '+13124029981' },
    ];
    const mappings = { Name: 'full_name' as const, Email: 'email' as const, Phone: 'phone' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows, intraFileDuplicates, problemRows } = detectDuplicatesAndDnc(normalized, []);

    assert.strictEqual(intraFileDuplicates, 1);
    assert.strictEqual(annotatedRows[0].isDuplicate, false);
    assert.strictEqual(annotatedRows[1].isDuplicate, true);
    assert.strictEqual(annotatedRows[1].duplicateType, 'intra_csv');
    assert.ok(annotatedRows[1].duplicateReason?.includes('matches row 2'));

    const problem = problemRows.find((p) => p.rowNumber === 3);
    assert.ok(problem);
    assert.strictEqual(problem.issueType, 'duplicate_csv');
  });

  test('Flags intra-CSV duplicate phone digits with exact row reference', () => {
    const rawRows = [
      { Name: 'First Lead', Phone: '(415) 555-2671', Email: 'first@test.com' },
      { Name: 'Second Lead', Phone: '415-555-2671', Email: 'second@test.com' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows, intraFileDuplicates } = detectDuplicatesAndDnc(normalized, []);

    assert.strictEqual(intraFileDuplicates, 1);
    assert.strictEqual(annotatedRows[1].isDuplicate, true);
    assert.strictEqual(annotatedRows[1].duplicateType, 'intra_csv');
  });

  test('Flags intra-CSV duplicate contact name + company', () => {
    const rawRows = [
      { Name: 'Elena Rostova', Company: 'Titan Supply', Phone: '+13124029981' },
      { Name: 'Elena Rostova', Company: 'Titan Supply', Phone: '+13124029982' },
    ];
    const mappings = { Name: 'full_name' as const, Company: 'company_name' as const, Phone: 'phone' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows, intraFileDuplicates } = detectDuplicatesAndDnc(normalized, []);

    assert.strictEqual(intraFileDuplicates, 1);
    assert.strictEqual(annotatedRows[1].isDuplicate, true);
    assert.strictEqual(annotatedRows[1].duplicateType, 'intra_csv');
  });

  // -------------------------------------------------------------------------
  // 6. DATABASE DEDUPLICATION & DNC IMMUTABILITY
  // -------------------------------------------------------------------------
  console.log('\n--- 6. DATABASE DEDUPLICATION & DNC PRESERVATION ---');

  const existingLeads: LeadRow[] = [
    {
      id: 'ld_existing_1',
      organization_id: 'org_123',
      name: 'Marcus Brody',
      company: 'PrimeFreight Inc.',
      title: 'VP Operations',
      phone: '+14158902104',
      email: 'm.brody@primefreight.io',
      city: 'San Francisco',
      status: 'contacted',
      do_not_call: false,
      deleted_at: null,
      created_by: 'usr_operator',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      temperature: 'WARM',
    },
    {
      id: 'ld_existing_dnc',
      organization_id: 'org_123',
      name: 'Protected Lead',
      company: 'Protected Corp',
      title: 'CEO',
      phone: '+14155550999',
      email: 'protected@corp.com',
      city: 'Austin',
      status: 'dnc',
      do_not_call: true,
      deleted_at: null,
      created_by: 'usr_operator',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      temperature: 'COLD',
    },
  ];

  test('Detects duplicate against existing Supabase lead by email', () => {
    const rawRows = [
      { Name: 'Marcus B.', Email: 'm.brody@primefreight.io', Phone: '+14150000000' },
    ];
    const mappings = { Name: 'full_name' as const, Email: 'email' as const, Phone: 'phone' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows, existingDuplicates } = detectDuplicatesAndDnc(normalized, existingLeads);

    assert.strictEqual(existingDuplicates, 1);
    assert.strictEqual(annotatedRows[0].isDuplicate, true);
    assert.strictEqual(annotatedRows[0].duplicateType, 'existing_database');
    assert.strictEqual(annotatedRows[0].matchedExistingLeadId, 'ld_existing_1');
    assert.ok(annotatedRows[0].duplicateReason?.includes('matches existing lead "Marcus Brody"'));
  });

  test('Detects duplicate against existing Supabase lead by phone digits', () => {
    const rawRows = [
      { Name: 'Marcus Brody', Phone: '415-890-2104', Email: 'different@email.com' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows, existingDuplicates } = detectDuplicatesAndDnc(normalized, existingLeads);

    assert.strictEqual(existingDuplicates, 1);
    assert.strictEqual(annotatedRows[0].isDuplicate, true);
    assert.strictEqual(annotatedRows[0].matchedExistingLeadId, 'ld_existing_1');
  });

  test('Strictly identifies and protects DNC leads from remote database', () => {
    const rawRows = [
      { Name: 'Protected Contact', Phone: '+1 415 555 0999', Email: 'other@corp.com' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows, dncCount, problemRows } = detectDuplicatesAndDnc(normalized, existingLeads);

    assert.strictEqual(dncCount, 1);
    assert.strictEqual(annotatedRows[0].isExistingDnc, true);

    const problem = problemRows.find((p) => p.issueType === 'dnc_protected');
    assert.ok(problem);
    assert.strictEqual(problem.issue, 'Do Not Call Protected');
  });

  // -------------------------------------------------------------------------
  // 7. DUPLICATE RESOLUTION STRATEGIES & DATABASE OPERATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- 7. DEDUPLICATION STRATEGIES & DB OPERATIONS ---');

  test('Strategy "skip" omits duplicates from insert and update lists', () => {
    const rawRows = [
      { Name: 'New Lead', Phone: '+14155551111', Email: 'new@lead.com' },
      { Name: 'Existing Lead', Phone: '+14158902104', Email: 'm.brody@primefreight.io' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows } = detectDuplicatesAndDnc(normalized, existingLeads);
    const ops = buildDatabaseOperations(annotatedRows, existingLeads, 'skip', 'org_123');

    assert.strictEqual(ops.toInsert.length, 1);
    assert.strictEqual(ops.toInsert[0].phone, '+14155551111');
    assert.strictEqual(ops.toUpdate.length, 0);
    assert.strictEqual(ops.skippedCount, 1);
  });

  test('Strategy "overwrite" prepares update operations without touching DNC leads', () => {
    const rawRows = [
      { Name: 'Marcus Brody Updated', Phone: '+14158902104', Email: 'm.brody@primefreight.io', City: 'Oakland' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const, City: 'city' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows } = detectDuplicatesAndDnc(normalized, existingLeads);
    const ops = buildDatabaseOperations(annotatedRows, existingLeads, 'overwrite', 'org_123');

    assert.strictEqual(ops.toInsert.length, 0);
    assert.strictEqual(ops.toUpdate.length, 1);
    assert.strictEqual(ops.toUpdate[0].id, 'ld_existing_1');
    assert.strictEqual(ops.toUpdate[0].updates.city, 'Oakland');
  });

  test('Strategy "update_missing" only fills empty fields on existing leads', () => {
    const rawRows = [
      { Name: 'Marcus Brody', Phone: '+14158902104', Email: 'm.brody@primefreight.io', City: 'San Jose' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const, City: 'city' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows } = detectDuplicatesAndDnc(normalized, existingLeads);
    // existing lead already has city 'San Francisco'
    const ops = buildDatabaseOperations(annotatedRows, existingLeads, 'update_missing', 'org_123');

    assert.strictEqual(ops.toUpdate.length, 1);
    // city should NOT be overwritten because existing lead already has city
    assert.strictEqual(ops.toUpdate[0].updates.city, undefined);
  });

  // -------------------------------------------------------------------------
  // 8. ERROR CSV GENERATION & RE-UPLOAD SCENARIO
  // -------------------------------------------------------------------------
  console.log('\n--- 8. ERROR CSV GENERATION & RE-UPLOAD SCENARIO ---');

  test('Generates valid, downloadable error CSV with row numbers and exact reasons', () => {
    const rawRows = [
      { Name: 'Bad Lead 1', Phone: 'invalid-phone', Email: '' },
      { Name: 'Duplicate Lead', Phone: '+14158902104', Email: 'm.brody@primefreight.io' },
      { Name: 'DNC Lead', Phone: '+14155550999', Email: 'dnc@test.com' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { problemRows } = detectDuplicatesAndDnc(normalized, existingLeads);

    const errorCsv = generateErrorCsv(problemRows);
    assert.ok(errorCsv.includes('Row Number,Status / Category,Issue Summary,Detailed Explanation'));
    assert.ok(errorCsv.includes('"invalid_data"'));
    assert.ok(errorCsv.includes('"duplicate_database"'));
    assert.ok(errorCsv.includes('"dnc_protected"'));
    assert.ok(errorCsv.includes('Marcus Brody'));

    // Check that CSV parser can re-read the error CSV cleanly
    const reParsed = parseCsv(errorCsv);
    assert.strictEqual(reParsed.rows.length, problemRows.length);
  });

  test('Re-uploading an already imported batch flags all rows as database duplicates with zero phantom inserts', () => {
    const rawRows = [
      { Name: 'Marcus Brody', Phone: '+14158902104', Email: 'm.brody@primefreight.io' },
    ];
    const mappings = { Name: 'full_name' as const, Phone: 'phone' as const, Email: 'email' as const };
    const normalized = normalizeCsvRows(rawRows, mappings, 'US');
    const { annotatedRows, existingDuplicates, intraFileDuplicates } = detectDuplicatesAndDnc(normalized, existingLeads);

    assert.strictEqual(existingDuplicates, 1);
    assert.strictEqual(intraFileDuplicates, 0);

    const ops = buildDatabaseOperations(annotatedRows, existingLeads, 'skip', 'org_123');
    assert.strictEqual(ops.toInsert.length, 0);
    assert.strictEqual(ops.skippedCount, 1);
  });

  console.log('\n======================================================================');
  console.log(`CSV IMPORT RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
