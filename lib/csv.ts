import type { CsvMetadataRow } from "@/lib/types";
import { sanitizeFilename } from "@/lib/html";

const REQUIRED_HEADER = "filename";
const ALLOWED_HEADERS = new Set(["filename", "subject", "preview_text", "internal_name"]);

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseMetadataCsv(contents: string): CsvMetadataRow[] {
  const normalized = contents.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  if (!headers.includes(REQUIRED_HEADER)) {
    throw new Error("Metadata CSV must include a filename column.");
  }

  for (const header of headers) {
    if (!ALLOWED_HEADERS.has(header)) {
      throw new Error(`Unsupported CSV column: ${header}`);
    }
  }

  const filenameIndex = headers.indexOf("filename");

  return lines.slice(1).map((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const filename = sanitizeFilename((cells[filenameIndex] || "").trim());

    if (!filename) {
      throw new Error(`CSV row ${rowIndex + 2} is missing a filename.`);
    }

    const row: CsvMetadataRow = { filename };

    headers.forEach((header, headerIndex) => {
      const value = (cells[headerIndex] || "").trim();
      if (!value) return;
      if (header === "subject") row.subject = value;
      if (header === "preview_text") row.preview_text = value;
      if (header === "internal_name") row.internal_name = value;
    });

    return row;
  });
}
