/**
 * 80/20 AI DIALER - RFC 4180 COMPLIANT CSV PARSER
 * Handles arbitrary delimiters, quotes, embedded newlines, commas in fields,
 * empty cells, repeated headers, and UTF-8 Byte Order Marks (BOM).
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  delimiter: string;
  errors: string[];
}

/**
 * Parses raw CSV string into headers and clean data row records.
 */
export function parseCsv(rawCsvText: string): ParsedCsvResult {
  const errors: string[] = [];

  if (!rawCsvText || typeof rawCsvText !== 'string' || !rawCsvText.trim()) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      delimiter: ',',
      errors: ['CSV content is empty or contains no data.'],
    };
  }

  // Strip UTF-8 Byte Order Mark (BOM: \uFEFF / 0xEF 0xBB 0xBF) if present
  let text = rawCsvText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const delimiter = detectDelimiter(text);
  const rawRows = splitCsvRowsAndColumns(text, delimiter);

  if (rawRows.length === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      delimiter,
      errors: ['No valid rows found in CSV file.'],
    };
  }

  // First non-empty row defines the headers
  const rawHeaders = rawRows[0];
  const headers: string[] = rawHeaders.map((h, idx) => {
    const trimmed = h.trim().replace(/^\uFEFF/, '');
    return trimmed.length > 0 ? trimmed : `Column_${idx + 1}`;
  });

  const normalizedHeaderKeys = headers.map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const rowValues = rawRows[i];

    // 1. Skip completely empty lines
    const hasValues = rowValues.some(
      (v) => v !== undefined && v !== null && v.trim() !== ''
    );
    if (!hasValues) {
      continue;
    }

    // 2. Skip repeated headers (common in merged export files)
    const isRepeatedHeader =
      rowValues.length === headers.length &&
      rowValues.every(
        (val, idx) => val.trim().toLowerCase() === normalizedHeaderKeys[idx]
      );
    if (isRepeatedHeader) {
      continue;
    }

    const rowObj: Record<string, string> = {
      __rowNumber: String(i + 1), // 1-based original line number
    };

    for (let hIdx = 0; hIdx < headers.length; hIdx++) {
      const headerName = headers[hIdx];
      const cellValue =
        rowValues[hIdx] !== undefined ? rowValues[hIdx].trim() : '';
      rowObj[headerName] = cellValue;
    }

    if (rowValues.length > headers.length) {
      errors.push(
        `Row ${i + 1}: Contains ${rowValues.length} columns (expected ${headers.length}). Extra columns ignored.`
      );
    }

    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    delimiter,
    errors,
  };
}

/**
 * Auto-detects delimiter (comma, semicolon, tab, pipe) based on initial rows.
 */
export function detectDelimiter(text: string): string {
  // Analyze first non-empty lines (up to 5 lines)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 5);

  if (lines.length === 0) return ',';

  const sample = lines.join('\n');
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const pipeCount = (sample.match(/\|/g) || []).length;

  const counts = [
    { delim: ',', count: commaCount },
    { delim: ';', count: semicolonCount },
    { delim: '\t', count: tabCount },
    { delim: '|', count: pipeCount },
  ];

  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delim : ',';
}

/**
 * Splits CSV string into rows and cells according to RFC 4180 rules:
 * - Double quotes enclose cells containing delimiters, newlines, or quotes
 * - Escaped double quotes ("") represent a literal quote
 * - Handles both CRLF (\r\n), LF (\n), and CR (\r) newlines
 */
function splitCsvRowsAndColumns(text: string, delimiter: string): string[][] {
  const result: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped double quote ("")
        currentCell += '"';
        i += 2;
        continue;
      } else {
        // Toggle quotation mode
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (!inQuotes) {
      if (char === delimiter) {
        currentRow.push(currentCell);
        currentCell = '';
        i++;
        continue;
      }

      if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentCell);
        result.push(currentRow);
        currentRow = [];
        currentCell = '';
        i += 2;
        continue;
      }

      if (char === '\n' || char === '\r') {
        currentRow.push(currentCell);
        result.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      }
    }

    currentCell += char;
    i++;
  }

  // Push final cell and row if present
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    result.push(currentRow);
  }

  return result;
}
