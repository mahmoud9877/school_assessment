import { CsvError, parse } from 'csv-parse/sync';
import { importFailed } from './import-errors.js';

export const MAX_IMPORT_ROWS = 1000;

export interface CsvRow {
  // 1-based line number in the file, for error messages.
  line: number;
  values: Record<string, string>;
}

// Parses a CSV whose header must contain exactly `columns` (any order, case
// and surrounding spaces ignored). Values are trimmed; blank lines skipped.
export function parseCsv(
  content: Buffer,
  columns: readonly string[],
): CsvRow[] {
  let records: { record: string[]; info: { lines: number } }[];
  try {
    // With `info: true` each record comes with its line number.
    records = parse(content, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      info: true,
    }) as unknown as typeof records;
  } catch (error) {
    if (error instanceof CsvError) {
      throw importFailed([
        {
          line: (error as CsvError & { lines?: number }).lines ?? 1,
          message: error.message,
        },
      ]);
    }
    throw error;
  }

  const [header, ...body] = records;
  if (!header) {
    throw importFailed([{ line: 1, message: 'File is empty' }]);
  }

  const byKey = new Map(columns.map((c) => [c.toLowerCase(), c]));
  const names = header.record.map((h) => byKey.get(h.toLowerCase()));
  // Every header is a known column, none repeats, and none is missing.
  if (
    names.includes(undefined) ||
    new Set(names).size !== names.length ||
    names.length !== columns.length
  ) {
    throw importFailed([
      {
        line: header.info.lines,
        message: `Header must be exactly: ${columns.join(',')} (got: ${header.record.join(',')})`,
      },
    ]);
  }
  if (body.length === 0) {
    throw importFailed([{ line: 2, message: 'File has no data rows' }]);
  }
  if (body.length > MAX_IMPORT_ROWS) {
    throw importFailed([
      {
        line: 1,
        message: `At most ${MAX_IMPORT_ROWS} rows per file (got ${body.length})`,
      },
    ]);
  }

  return body.map(({ record, info }) => ({
    line: info.lines,
    values: Object.fromEntries(names.map((name, i) => [name!, record[i]])),
  }));
}
