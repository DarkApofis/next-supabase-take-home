import type { Cursor } from "@/domain/coffee-records/cursor";
import {
  BOOLEAN_FILTERS,
  type Filters,
  type ListQuery,
  MULTI_FILTERS,
  type MultiFilterKey,
  RANGE_FILTERS,
} from "@/domain/coffee-records/query";

/** PostgREST filter calls as data, so the mapping is testable without a client. */
export type FilterOp =
  | { op: "in"; column: string; value: readonly string[] }
  | { op: "gte" | "lte" | "gt" | "lt"; column: string; value: number }
  | { op: "eq"; column: string; value: boolean }
  | { op: "or"; value: string };

export function buildFilterOps(filters: Filters): FilterOp[] {
  const ops: FilterOp[] = [];
  for (const column of Object.keys(MULTI_FILTERS) as MultiFilterKey[]) {
    const values = filters[column];
    if (values.length) ops.push({ op: "in", column, value: values });
  }
  for (const column of RANGE_FILTERS) {
    const { min, max } = filters[column];
    if (min !== undefined) ops.push({ op: "gte", column, value: min });
    if (max !== undefined) ops.push({ op: "lte", column, value: max });
  }
  for (const column of BOOLEAN_FILTERS) {
    const value = filters[column];
    if (value !== undefined) ops.push({ op: "eq", column, value });
  }
  return ops;
}

/**
 * Keyset seek past `cursor` in the requested direction. PostgREST has no row
 * comparison, so `(col, id) > (cursor.v, cursor.id)` is spelled as
 * `col > cursor.v OR (col = cursor.v AND id > cursor.id)`, plus a redundant
 * `col >= cursor.v` that gives the planner an index range to start from
 * instead of filtering the OR across the whole index.
 */
export function buildKeysetOps(
  sort: ListQuery["sort"],
  cursor: Cursor,
  nav: "next" | "prev",
): { ops: FilterOp[]; ascending: boolean } {
  const ascending = (sort.dir === "asc") === (nav === "next");
  const past = ascending ? "gt" : "lt";
  const { column } = sort;
  if (column === "id") return { ascending, ops: [{ op: past, column: "id", value: cursor.id }] };
  return {
    ascending,
    ops: [
      { op: ascending ? "gte" : "lte", column, value: cursor.v },
      {
        op: "or",
        value: `${column}.${past}.${cursor.v},and(${column}.eq.${cursor.v},id.${past}.${cursor.id})`,
      },
    ],
  };
}
