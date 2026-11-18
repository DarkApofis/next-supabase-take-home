import { type Cursor, cursorFor } from "@/domain/coffee-records/cursor";
import { type Filters, type ListQuery, PAGE_SIZE } from "@/domain/coffee-records/query";
import type { CoffeeRecord } from "@/domain/coffee-records/record";

export type PageRequest = { filters: Filters; sort: ListQuery["sort"]; limit: number } & (
  | { mode: "offset"; offset: number }
  | { mode: "keyset"; cursor: Cursor; nav: "next" | "prev" }
);

/** Port implemented by the infrastructure layer. */
export interface CoffeeRecordRepository {
  /** Rows in display order. For `nav: "prev"`, the `limit` rows right before the cursor. */
  findPage(req: PageRequest): Promise<CoffeeRecord[]>;
  countEstimate(filters: Filters): Promise<{ count: number; exact: boolean }>;
}

export type RecordsPage = {
  rows: CoffeeRecord[];
  page: number;
  totalPages: number;
  total: number;
  totalIsExact: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor: Cursor | null;
  prevCursor: Cursor | null;
};

/**
 * Hybrid pagination: Prev/Next follow a keyset cursor (constant cost at any
 * depth); a numbered jump uses OFFSET (cost grows with the page number).
 * One extra row is fetched to know whether another page exists without counting.
 */
export async function listCoffeeRecords(
  repo: CoffeeRecordRepository,
  q: ListQuery,
): Promise<RecordsPage> {
  const position = q.cursor
    ? ({ mode: "keyset", cursor: q.cursor.token, nav: q.cursor.nav } as const)
    : ({ mode: "offset", offset: (q.page - 1) * PAGE_SIZE } as const);

  const [fetched, { count, exact }] = await Promise.all([
    repo.findPage({ filters: q.filters, sort: q.sort, limit: PAGE_SIZE + 1, ...position }),
    repo.countEstimate(q.filters),
  ]);

  const extra = fetched.length > PAGE_SIZE;
  const goingBack = q.cursor?.nav === "prev";
  // Going back, the extra row sits before the page; otherwise after it.
  const rows = !extra ? fetched : goingBack ? fetched.slice(1) : fetched.slice(0, PAGE_SIZE);
  const found = rows.length > 0;
  const hasNext = found && (goingBack || extra);
  // A Next cursor always has rows behind it; otherwise trust the page number.
  const hasPrev = found && (goingBack ? extra : q.cursor !== undefined || q.page > 1);
  // A Prev that runs out of rows has reached the start, whatever the URL said.
  const page = goingBack && !extra ? 1 : q.page;

  // The count may be a planner estimate; what we just saw beats it.
  const onLastPage = found && !hasNext;
  const seen = (page - 1) * PAGE_SIZE + rows.length;
  // Never report fewer records than are already on or before this page.
  const total = onLastPage ? seen : found ? Math.max(count, seen + 1) : count;
  const estimatedPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const totalPages = hasNext
    ? Math.max(estimatedPages, page + 1)
    : found
      ? page
      : estimatedPages;

  return {
    rows,
    page,
    totalPages,
    total,
    totalIsExact: exact || onLastPage,
    hasNext,
    hasPrev,
    nextCursor: hasNext ? cursorFor(rows[rows.length - 1], q.sort) : null,
    prevCursor: hasPrev ? cursorFor(rows[0], q.sort) : null,
  };
}
