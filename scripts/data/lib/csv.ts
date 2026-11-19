// Minimal CSV parsing (RFC 4180 quotes). Enough for every source here; no dependency needed.

// Splits one CSV line into fields. For streamed files where no field contains a newline.
export function parseCsvLine(line: string): string[] {
  return parseCsvRecords(line)[0] ?? [""];
}

// Parses CSV text into records (arrays of fields). Quoted fields may contain commas, quotes and newlines.
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
      }
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

// Parses a whole CSV text into objects keyed by the header row. Blank lines are skipped.
export function parseCsv(text: string): Record<string, string>[] {
  const records = parseCsvRecords(text).filter((r) => !(r.length === 1 && r[0] === ""));
  const header = records[0];
  return records.slice(1).map((values) => {
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}
