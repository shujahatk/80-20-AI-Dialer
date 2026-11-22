/**
 * RM AI DIALER - RFC 4180 COMPLIANT CSV PARSER
 * Handles arbitrary delimiters, quotes, newlines, empty cells, and UTF-8 BOM.
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  delimiter: string;
  errors: string[];
}

/**
 * Parses raw CSV string into headers and records.
 */
export function parseCsv(rawCsvText: string): ParsedCsvResult {
  const errors: string[] = [];

  if (!rawCsvText || !rawCsvText.trim()) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      delimiter: ',',
      errors: ['CSV content is empty'],
    };
  }

  // Strip UTF-8 Byte Order Mark (BOM) if present
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
      errors: ['No valid rows found in CSV'],
    };
  }

  // First row is headers
  const rawHeaders = rawRows[0];
  const headers: string[] = rawHeaders.map((h, idx) => {
    const trimmed = h.trim();
    return trimmed.length > 0 ? trimmed : `Column_${idx + 1}`;
  });

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const rowValues = rawRows[i];

    // Skip empty lines
    if (rowValues.length === 1 && rowValues[0].trim() === '') {
      continue;
    }

    const rowObj: Record<string, string> = {};
    for (let hIdx = 0; hIdx < headers.length; hIdx++) {
      const headerName = headers[hIdx];
      const cellValue = rowValues[hIdx] !== undefined ? rowValues[hIdx].trim() : '';
      rowObj[headerName] = cellValue;
    }

    if (rowValues.length > headers.length) {
      errors.push(`Row ${i}: Contains ${rowValues.length} columns, expected ${headers.length}. Extra values truncated.`);
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
 * Auto-detects the most likely delimiter based on first few lines.
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;

  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  return ',';
}

/**
 * Splits CSV string into rows and cells according to RFC 4180 rules.
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
        // Toggle quote mode
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

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    result.push(currentRow);
  }

  return result;
}
