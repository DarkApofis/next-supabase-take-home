import { type CoffeeRecord, coffeeRecordSchema } from "./record.ts";

// Column order of both the CSV and the INSERT column list. The CSV header is
// the same names in mixed case (ID, Coffee_Intake, ...).
const COLUMNS = [
  "id",
  "age",
  "gender",
  "country",
  "coffee_intake",
  "caffeine_mg",
  "sleep_hours",
  "sleep_quality",
  "bmi",
  "heart_rate",
  "stress_level",
  "physical_activity_hours",
  "health_issues",
  "occupation",
  "smoking",
  "alcohol_consumption",
] as const satisfies readonly (keyof CoffeeRecord)[];

const NUMERIC = new Set<string>([
  "id",
  "age",
  "coffee_intake",
  "caffeine_mg",
  "sleep_hours",
  "bmi",
  "heart_rate",
  "physical_activity_hours",
]);
const FLAG = new Set<string>(["smoking", "alcohol_consumption"]);
// Plain decimal with at most one fractional digit: matches the numeric(p,1)
// columns, so Postgres never silently rounds a seeded value.
const DECIMAL_1DP = /^\d+(\.\d)?$/;

function toFieldValue(column: string, raw: string): unknown {
  if (NUMERIC.has(column)) return DECIMAL_1DP.test(raw) ? Number(raw) : NaN;
  if (FLAG.has(column)) return raw === "1" ? true : raw === "0" ? false : raw;
  return raw;
}

// shortcut: plain comma split; the dataset has no quoted fields. Use a real CSV parser if that changes.
export function parseCsv(text: string): CoffeeRecord[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0].toLowerCase() !== COLUMNS.join(",")) {
    throw new Error(`Unexpected CSV header: ${lines[0]}`);
  }

  const records: CoffeeRecord[] = [];
  lines.forEach((line, i) => {
    if (i === 0 || line === "") return;
    const cells = line.split(",");
    if (cells.length !== COLUMNS.length) {
      throw new Error(
        `Invalid row on line ${i + 1}: expected ${COLUMNS.length} cells, got ${cells.length}`,
      );
    }
    const candidate = Object.fromEntries(
      COLUMNS.map((column, c) => [column, toFieldValue(column, cells[c])]),
    );
    const parsed = coffeeRecordSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`Invalid row on line ${i + 1}: ${parsed.error.message}`);
    }
    records.push(parsed.data);
  });
  return records;
}

function literal(value: CoffeeRecord[keyof CoffeeRecord]): string {
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return String(value);
}

/** Batched multi-row INSERTs in one transaction (one statement per batch on reset). */
export function toInsertStatements(rows: CoffeeRecord[], batchSize = 1000): string {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`batchSize must be a positive integer, got ${batchSize}`);
  }
  const out = ["begin;"];
  for (let i = 0; i < rows.length; i += batchSize) {
    const values = rows
      .slice(i, i + batchSize)
      .map((r) => `(${COLUMNS.map((c) => literal(r[c])).join(", ")})`)
      .join(",\n");
    out.push(
      `insert into public.coffee_health_records (${COLUMNS.join(", ")}) values\n${values};`,
    );
  }
  out.push("commit;");
  return out.join("\n") + "\n";
}
