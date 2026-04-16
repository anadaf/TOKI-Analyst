import { readFileSync } from "fs";
import { join } from "path";

/* ─────────────────── Types ─────────────────── */

export interface CsvFilters {
  dateFrom?: string; // ISO YYYY-MM-DD
  dateTo?: string;   // ISO YYYY-MM-DD
  students?: string[];
  lessons?: string[];
}

export interface CsvMetadata {
  students: string[];
  lessons: string[];
  dateRange: { from: string; to: string }; // ISO YYYY-MM-DD
}

/* ─────────────────── Parsing ─────────────────── */

/** Quote-aware comma split for a single CSV line. */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped double-quote ("")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(parseCSVLine);
  return { headers, rows };
}

/* ─────────────────── Date helpers ─────────────────── */

/** Convert DD/MM/YYYY → YYYY-MM-DD. Returns empty string on malformed input. */
function toISO(ddmmyyyy: string): string {
  const parts = ddmmyyyy.trim().split("/");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/* ─────────────────── Filtering ─────────────────── */

/**
 * Apply filters to a CSV. Returns the header line plus matching rows joined with \n.
 * Unknown columns are ignored gracefully.
 */
export function applyFilters(csv: string, filters?: CsvFilters): string {
  if (!filters) return csv;
  const hasAny =
    filters.dateFrom ||
    filters.dateTo ||
    (filters.students && filters.students.length > 0) ||
    (filters.lessons && filters.lessons.length > 0);
  if (!hasAny) return csv;

  const lines = csv.split(/\r?\n/);
  if (lines.length <= 1) return csv;

  const header = lines[0];
  const headerCols = parseCSVLine(header);
  const idxStudent = headerCols.indexOf("Student id");
  const idxDate = headerCols.indexOf("local_date");
  const idxLesson = headerCols.indexOf("Lesson title");

  const studentSet = filters.students?.length ? new Set(filters.students) : null;
  const lessonSet = filters.lessons?.length ? new Set(filters.lessons) : null;

  const kept: string[] = [header];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);

    if (studentSet && idxStudent >= 0 && !studentSet.has(cols[idxStudent])) continue;
    if (lessonSet && idxLesson >= 0 && !lessonSet.has(cols[idxLesson])) continue;

    if ((filters.dateFrom || filters.dateTo) && idxDate >= 0) {
      const iso = toISO(cols[idxDate]);
      if (!iso) continue;
      if (filters.dateFrom && iso < filters.dateFrom) continue;
      if (filters.dateTo && iso > filters.dateTo) continue;
    }

    kept.push(line);
  }
  return kept.join("\n");
}

/* ─────────────────── Metadata ─────────────────── */

export function getMetadata(csv: string): CsvMetadata {
  const { headers, rows } = parseCSV(csv);
  const idxStudent = headers.indexOf("Student id");
  const idxDate = headers.indexOf("local_date");
  const idxLesson = headers.indexOf("Lesson title");

  const studentsSet = new Set<string>();
  const lessonsSet = new Set<string>();
  let minDate = "";
  let maxDate = "";

  for (const row of rows) {
    if (idxStudent >= 0 && row[idxStudent]) studentsSet.add(row[idxStudent]);
    if (idxLesson >= 0 && row[idxLesson]) lessonsSet.add(row[idxLesson]);
    if (idxDate >= 0 && row[idxDate]) {
      const iso = toISO(row[idxDate]);
      if (iso) {
        if (!minDate || iso < minDate) minDate = iso;
        if (!maxDate || iso > maxDate) maxDate = iso;
      }
    }
  }

  return {
    students: Array.from(studentsSet).sort(),
    lessons: Array.from(lessonsSet).sort(),
    dateRange: { from: minDate, to: maxDate },
  };
}

/* ─────────────────── Server-side default CSV cache ─────────────────── */

let csvCache: string | null = null;
export function getDefaultCSV(): string {
  if (!csvCache) {
    try {
      csvCache = readFileSync(
        join(process.cwd(), "public/data/classroom.csv"),
        "utf-8"
      );
    } catch {
      csvCache = "";
    }
  }
  return csvCache;
}
