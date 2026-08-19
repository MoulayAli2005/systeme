/**
 * Small RFC 4180 style CSV helpers. Carrier statements and merchant order
 * exports routinely contain quoted commas, embedded newlines and a UTF-8 BOM
 * from Excel, so splitting on "," is not enough.
 */

export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const sep = delimiter ?? sniffDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function sniffDelimiter(text: string) {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  // Exports from French/Arabic locale spreadsheets default to semicolons.
  return semicolons > commas ? ";" : ",";
}

export function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parses a CSV into objects keyed by normalized header, so `Customer Name`,
 * `customer_name` and `customername` all resolve to the same field.
 */
export function parseCsvRecords(input: string, delimiter?: string) {
  const rows = parseCsv(input, delimiter);
  if (!rows.length) return { headers: [] as string[], records: [] as Record<string, string>[] };
  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (row[index] ?? "").trim();
    });
    return record;
  });
  return { headers, records };
}

/** Reads the first present column among several accepted spellings. */
export function pick(record: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[normalizeHeader(key)];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

/** Tolerates "1 234,56", "1,234.56" and currency suffixes. */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\d.,-]/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
