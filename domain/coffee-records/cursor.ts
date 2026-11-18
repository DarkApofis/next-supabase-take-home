import { z } from "zod";
import { SORT_COLUMNS, type SortColumn, type SortDir } from "./options.ts";
import { coffeeRecordSchema } from "./record.ts";

/**
 * Keyset position: sort value and id of a boundary row, plus the sort it was
 * minted under so a cursor can't be replayed against a different ordering.
 */
export type Cursor = { v: number; id: number; s: SortColumn; d: SortDir };

// Tokens come back from the URL, so the sort value must be one its column can
// hold (the record schema mirrors the column types and CHECK constraints);
// otherwise Postgres rejects the literal and the page would error.
const cursorSchema = z
  .object({
    v: z.number(),
    id: coffeeRecordSchema.shape.id,
    s: z.enum(SORT_COLUMNS),
    d: z.enum(["asc", "desc"]),
  })
  .refine((c) => coffeeRecordSchema.shape[c.s].safeParse(c.v).success)
  // Sorting by id, the sort value *is* the id; disagreeing halves are forged.
  .refine((c) => c.s !== "id" || c.v === c.id);

/** Cursor pointing at `row` under the given sort. */
export function cursorFor(
  row: Record<SortColumn, number>,
  sort: { column: SortColumn; dir: SortDir },
): Cursor {
  return { v: row[sort.column], id: row.id, s: sort.column, d: sort.dir };
}

// btoa/atob instead of Buffer: this module is also bundled for the browser.
export function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify({ v: c.v, id: c.id, s: c.s, d: c.d }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeCursor(s: string): Cursor | null {
  try {
    const json = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = cursorSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
