import { z } from "zod";
import { SORT_COLUMNS, type SortColumn, type SortDir } from "./options.ts";

/**
 * Keyset position: sort value and id of a boundary row, plus the sort it was
 * minted under so a cursor can't be replayed against a different ordering.
 */
export type Cursor = { v: number; id: number; s: SortColumn; d: SortDir };

// Columns stored as integer/smallint: a decimal cursor value would be a Postgres cast error.
const INTEGER_SORT_COLUMNS = new Set<SortColumn>(["id", "age", "heart_rate"]);
const PG_INT_MAX = 2_147_483_647;

// Tokens come back from the URL, so bound them to what the columns can hold.
const cursorSchema = z
  .object({
    v: z.number().min(-1e6).max(1e6),
    id: z.number().int().min(1).max(PG_INT_MAX),
    s: z.enum(SORT_COLUMNS),
    d: z.enum(["asc", "desc"]),
  })
  .refine((c) => !INTEGER_SORT_COLUMNS.has(c.s) || Number.isInteger(c.v));

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
