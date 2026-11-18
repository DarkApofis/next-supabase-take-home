import { type Cursor, decodeCursor, encodeCursor } from "./cursor.ts";
import {
  COUNTRIES,
  GENDERS,
  HEALTH_ISSUES,
  OCCUPATIONS,
  SLEEP_QUALITIES,
  SORT_COLUMNS,
  type SortColumn,
  type SortDir,
  STRESS_LEVELS,
} from "./options.ts";

export { SORT_COLUMNS, type SortColumn, type SortDir };

export const PAGE_SIZE = 25;

export type Range = { min?: number; max?: number };

export const MULTI_FILTERS = {
  country: COUNTRIES,
  gender: GENDERS,
  sleep_quality: SLEEP_QUALITIES,
  stress_level: STRESS_LEVELS,
  occupation: OCCUPATIONS,
  health_issues: HEALTH_ISSUES,
} as const;
export type MultiFilterKey = keyof typeof MULTI_FILTERS;

export const RANGE_FILTERS = [
  "age",
  "coffee_intake",
  "caffeine_mg",
  "bmi",
  "sleep_hours",
] as const;
export type RangeFilterKey = (typeof RANGE_FILTERS)[number];

export const BOOLEAN_FILTERS = ["smoking", "alcohol_consumption"] as const;
export type BooleanFilterKey = (typeof BOOLEAN_FILTERS)[number];

export type Filters = {
  -readonly [K in MultiFilterKey]: (typeof MULTI_FILTERS)[K][number][];
} & Record<RangeFilterKey, Range> & { [K in BooleanFilterKey]?: boolean };

export type ListQuery = {
  filters: Filters;
  sort: { column: SortColumn; dir: SortDir };
  page: number;
  cursor?: { token: Cursor; nav: "next" | "prev" };
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const MULTI_KEYS = Object.keys(MULTI_FILTERS) as MultiFilterKey[];
const DECIMAL = /^-?\d+(\.\d+)?$/;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parseMulti<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T[] {
  if (raw === undefined) return [];
  const values = (Array.isArray(raw) ? raw : [raw]).flatMap((s) => s.split(","));
  const known = values.filter((v): v is T => (allowed as readonly string[]).includes(v));
  return [...new Set(known)];
}

function parseNumber(raw: string | undefined): number | undefined {
  return raw !== undefined && DECIMAL.test(raw) ? Number(raw) : undefined;
}

function parseRange(sp: RawSearchParams, key: RangeFilterKey): Range {
  let min = parseNumber(first(sp[`${key}_min`]));
  let max = parseNumber(first(sp[`${key}_max`]));
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  return {
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
  };
}

function parseBoolean(raw: string | undefined): boolean | undefined {
  return raw === "true" ? true : raw === "false" ? false : undefined;
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

/** URL search params → typed query. Never throws: bad values fall back to defaults. */
export function parseListQuery(sp: RawSearchParams): ListQuery {
  const multi = Object.fromEntries(
    MULTI_KEYS.map((key) => [key, parseMulti(sp[key], MULTI_FILTERS[key])]),
  ) as Pick<Filters, MultiFilterKey>;
  const ranges = Object.fromEntries(
    RANGE_FILTERS.map((key) => [key, parseRange(sp, key)]),
  ) as Record<RangeFilterKey, Range>;
  const filters: Filters = { ...multi, ...ranges };
  for (const key of BOOLEAN_FILTERS) {
    const b = parseBoolean(first(sp[key]));
    if (b !== undefined) filters[key] = b;
  }

  const sortRaw = first(sp.sort);
  const column = (SORT_COLUMNS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as SortColumn)
    : "id";
  const dir: SortDir = first(sp.dir) === "desc" ? "desc" : "asc";

  const query: ListQuery = { filters, sort: { column, dir }, page: parsePage(first(sp.page)) };

  const nav = first(sp.nav);
  const token = decodeCursor(first(sp.cursor) ?? "");
  if (token && token.s === column && token.d === dir && (nav === "next" || nav === "prev")) {
    query.cursor = { token, nav };
  }

  return query;
}

/** Typed query → URL params, omitting defaults so URLs stay short. */
export function toSearchParams(q: ListQuery): URLSearchParams {
  const sp = new URLSearchParams();
  for (const key of MULTI_KEYS) {
    const values = q.filters[key];
    if (values.length) sp.set(key, values.join(","));
  }
  for (const key of RANGE_FILTERS) {
    const { min, max } = q.filters[key];
    if (min !== undefined) sp.set(`${key}_min`, String(min));
    if (max !== undefined) sp.set(`${key}_max`, String(max));
  }
  for (const key of BOOLEAN_FILTERS) {
    const b = q.filters[key];
    if (b !== undefined) sp.set(key, String(b));
  }
  if (q.sort.column !== "id") sp.set("sort", q.sort.column);
  if (q.sort.dir !== "asc") sp.set("dir", q.sort.dir);
  if (q.page > 1) sp.set("page", String(q.page));
  if (q.cursor) {
    sp.set("cursor", encodeCursor(q.cursor.token));
    sp.set("nav", q.cursor.nav);
  }
  return sp;
}

/** Any filter or sort change invalidates the position: back to page 1, no cursor. */
export function withQueryChange(
  q: ListQuery,
  change: Partial<Pick<ListQuery, "filters" | "sort">>,
): ListQuery {
  return {
    filters: change.filters ?? q.filters,
    sort: change.sort ?? q.sort,
    page: 1,
  };
}
