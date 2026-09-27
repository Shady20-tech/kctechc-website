/**
 * RFC 4180 CSV parsing.
 *
 * Hand-rolled rather than pulled from a package, because the format is small and
 * fully specified and the failure mode of getting it wrong is silent data
 * corruption — a description containing a comma would split into two columns and
 * the import would report a confusing error against the wrong field. Having the
 * parser here means it is tested against the cases that actually occur in
 * exported spreadsheets: quoted fields, embedded commas and newlines, doubled
 * quotes, a byte-order mark, and CRLF endings.
 *
 * What is deliberately NOT supported: a configurable delimiter, and type
 * inference. The former is a different format; the latter belongs in the
 * per-column validators where it can produce a useful message.
 */

export type CsvRow = readonly string[];

export interface ParsedCsv {
  /** Header cells, trimmed. */
  header: CsvRow;
  /** Data rows, excluding the header. */
  rows: CsvRow[];
  /**
   * Rows whose cell count differs from the header's, with their 1-based line
   * number in the source. Reported rather than thrown so the caller can show
   * every problem in one pass instead of one per attempt.
   */
  ragged: { line: number; cells: number }[];
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * Parse a CSV document into a header and rows.
 *
 * A leading byte-order mark is stripped: spreadsheets write one, and left in
 * place it becomes part of the first header name, so `regionCode` silently
 * becomes `\uFEFFregionCode` and every lookup of that column fails.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  if (text.trim() === "") {
    throw new CsvParseError("The file is empty.");
  }

  const { records, lineOf } = tokenize(text);

  const firstRecord = records.at(0);
  if (!firstRecord) {
    throw new CsvParseError("The file has no rows.");
  }

  const header = firstRecord.map((cell) => cell.trim());

  const seen = new Set<string>();
  const duplicateHeaders = header.filter((name) => {
    if (seen.has(name)) return true;
    seen.add(name);
    return false;
  });
  if (duplicateHeaders.length > 0) {
    throw new CsvParseError(
      `Duplicate column${duplicateHeaders.length > 1 ? "s" : ""}: ${duplicateHeaders.join(", ")}.`,
    );
  }

  const rows: CsvRow[] = [];
  const ragged: { line: number; cells: number }[] = [];

  for (let i = 1; i < records.length; i += 1) {
    const record = records[i];
    if (!record) continue;
    // A trailing newline produces a final empty record; skipping it avoids a
    // spurious "row has 1 cell, expected 14" error on every well-formed file.
    if (record.length === 1 && (record[0] ?? "").trim() === "") continue;

    if (record.length !== header.length) {
      ragged.push({ line: lineOf[i] ?? i + 1, cells: record.length });
      continue;
    }
    rows.push(record);
  }

  return { header, rows, ragged };
}

/**
 * Split the document into records, tracking each record's source line.
 *
 * A single pass with an explicit state flag rather than a regular expression,
 * because the quoted-field rules are context-dependent: a newline inside quotes
 * is data, and a comma inside quotes is not a delimiter. A regex that handled
 * both correctly would be harder to read than this.
 */
function tokenize(text: string): { records: string[][]; lineOf: number[] } {
  const records: string[][] = [];
  const lineOf: number[] = [];

  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;

  const endField = () => {
    record.push(field);
    field = "";
  };

  const endRecord = () => {
    endField();
    records.push(record);
    lineOf.push(recordStartLine);
    record = [];
    recordStartLine = line;
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          // A doubled quote inside a quoted field is a literal quote.
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        // A quote in the middle of an unquoted field. Excel tolerates this and
        // treats it as a literal; doing the same avoids rejecting real exports.
        field += char;
      } else {
        inQuotes = true;
      }
      continue;
    }

    if (char === ",") {
      endField();
      continue;
    }

    if (char === "\r") {
      // Part of a CRLF pair, handled by the \n branch.
      continue;
    }

    if (char === "\n") {
      endRecord();
      line += 1;
      recordStartLine = line;
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new CsvParseError(
      `Unterminated quoted field starting near line ${recordStartLine}.`,
    );
  }

  // A document not ending in a newline still has a final record.
  if (field.length > 0 || record.length > 0) {
    endRecord();
  }

  return { records, lineOf };
}

/**
 * Parse a cell that should hold a list.
 *
 * Uses `|` rather than `,` as the separator, because a comma is the CSV
 * delimiter and a comma-separated list inside a CSV cell is exactly the case
 * that produces mangled data. `|` needs no quoting and survives a round trip
 * through every spreadsheet this is likely to come from.
 */
export function parseListCell(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}
