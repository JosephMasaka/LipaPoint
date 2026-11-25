import { inflateRawSync } from "node:zlib";
import { ConnectError } from "../errors";
import { MAX_UPLOAD_BYTES } from "../types";
import type { Connector, ConnectorContext, ConnectorResult, ConnectorTestResult } from "../types";

/**
 * Spreadsheet connector: CSV and .xlsx uploads.
 *
 * CSV is parsed here. .xlsx is read with a deliberately small ZIP + SpreadsheetML
 * reader (node:zlib only) instead of adding `xlsx` to production dependencies:
 * the only `xlsx` build on npm is 0.18.5, whose prototype-pollution
 * (CVE-2023-30533) and ReDoS (CVE-2024-22363) fixes exist only in the
 * vendor-hosted 0.19.3+/0.20.2+ releases. Parsing the two XML parts a data
 * import needs is smaller than shipping a known-vulnerable parser.
 *
 * Limits: first worksheet only, 5,000 rows, values read as text (dates stay
 * ISO strings from the cell), ZIP64 workbooks are refused.
 */

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

export function parseCsv(text: string): Record<string, string>[] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // handled by the \n branch; a lone \r also ends the line
      if (input[i + 1] !== "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return toObjects(rows);
}

/* ------------------------------------------------------------------ *
 * XLSX (ZIP + SpreadsheetML)
 * ------------------------------------------------------------------ */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 65_558);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

export function readZip(buffer: Buffer): Map<string, Buffer> {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    throw new ConnectError("That file is not a valid .xlsx workbook", 400, "CONNECT_XLSX_INVALID");
  }
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();

  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const entry: ZipEntry = {
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      name: "",
      localOffset: buffer.readUInt32LE(offset + 42),
    };
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entry.name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (entry.localOffset + 30 <= buffer.length && buffer.readUInt32LE(entry.localOffset) === 0x04034b50) {
      const localNameLength = buffer.readUInt16LE(entry.localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(entry.localOffset + 28);
      const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
      const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);
      if (entry.method === 0) entries.set(entry.name, Buffer.from(raw));
      else if (entry.method === 8) entries.set(entry.name, inflateRawSync(raw));
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function readSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = siPattern.exec(xml))) {
    const parts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    strings.push(parts.join(""));
  }
  return strings;
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

/** SpreadsheetML rows -> a matrix of strings, honouring cell references. */
export function readSheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(xml))) {
    const cells: string[] = [];
    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
      const attrs = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const reference = attrs.match(/\br="([A-Z]+)\d+"/i)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const index = reference ? columnIndex(reference) : cells.length;

      let value = "";
      if (type === "s") {
        const shared = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        value = shared !== undefined ? sharedStrings[Number(shared)] ?? "" : "";
      } else if (type === "inlineStr") {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join("");
      } else {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        value = raw !== undefined ? decodeXml(raw) : "";
      }
      cells[index] = value;
    }
    rows.push(Array.from(cells, (cell) => cell ?? ""));
  }
  return rows;
}

function toObjects(rows: string[][]): Record<string, string>[] {
  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((header) => header.trim());
  return nonEmpty.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = (row[index] ?? "").trim();
    });
    return record;
  });
}

export function parseXlsx(buffer: Buffer): Record<string, string>[] {
  const files = readZip(buffer);
  const sharedEntry = files.get("xl/sharedStrings.xml");
  const shared = sharedEntry ? readSharedStrings(sharedEntry.toString("utf8")) : [];

  const sheetName =
    [...files.keys()].find((name) => /^xl\/worksheets\/sheet1\.xml$/.test(name)) ??
    [...files.keys()].sort().find((name) => /^xl\/worksheets\/.*\.xml$/.test(name));

  if (!sheetName) {
    throw new ConnectError("That workbook has no worksheet", 400, "CONNECT_XLSX_NO_SHEET");
  }

  return toObjects(readSheetXml(files.get(sheetName)!.toString("utf8"), shared));
}

/* ------------------------------------------------------------------ *
 * Connector
 * ------------------------------------------------------------------ */

const MAX_ROWS = 5_000;

function loadRows(context: ConnectorContext): Record<string, string>[] {
  const source = context.source;
  if (!source) {
    throw new ConnectError(
      "Upload a CSV or Excel file for this connection before syncing",
      400,
      "CONNECT_FILE_MISSING"
    );
  }
  const buffer = Buffer.from(source.content, "base64");
  if (buffer.byteLength === 0) {
    throw new ConnectError("The uploaded file is empty", 400, "CONNECT_FILE_EMPTY");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new ConnectError("The uploaded file is larger than 5 MB", 400, "CONNECT_FILE_TOO_LARGE");
  }
  return source.format === "xlsx" ? parseXlsx(buffer) : parseCsv(buffer.toString("utf8"));
}

export const fileConnector: Connector = {
  id: "file",

  async testConnection(context: ConnectorContext): Promise<ConnectorTestResult> {
    try {
      if (!context.source) return { ok: true, accountLabel: "Spreadsheet upload (no file yet)" };
      const rows = loadRows(context);
      return { ok: true, accountLabel: `${rows.length} row${rows.length === 1 ? "" : "s"} readable` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "The file could not be read" };
    }
  },

  async fetchRecords(context: ConnectorContext): Promise<ConnectorResult> {
    try {
      const rows = loadRows(context);
      if (rows.length > MAX_ROWS) {
        return {
          ok: false,
          code: "CONNECT_FILE_TOO_MANY_ROWS",
          message: `That file has ${rows.length} rows — the limit is ${MAX_ROWS}`,
          retryable: false,
        };
      }
      const idField = typeof context.config.idField === "string" && context.config.idField.trim()
        ? context.config.idField.trim()
        : "id";
      const records = rows.map((row, index) => ({
        externalId: (row[idField] ?? "").trim() || `row-${index + 2}`,
        data: row,
      }));
      return { ok: true, records, nextCursor: null };
    } catch (error) {
      if (error instanceof ConnectError) {
        return { ok: false, code: error.code, message: error.message, retryable: false };
      }
      return {
        ok: false,
        code: "CONNECT_FILE_INVALID",
        message: "The file could not be read",
        retryable: false,
      };
    }
  },
};
