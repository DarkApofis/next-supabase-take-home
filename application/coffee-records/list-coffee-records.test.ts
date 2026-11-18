import { describe, expect, it } from "vitest";
import type { Cursor } from "@/domain/coffee-records/cursor";
import { parseListQuery, type Filters, type ListQuery } from "@/domain/coffee-records/query";
import type { CoffeeRecord } from "@/domain/coffee-records/record";
import {
  type CoffeeRecordRepository,
  listCoffeeRecords,
  type PageRequest,
} from "./list-coffee-records";

const record = (id: number, age: number): CoffeeRecord => ({
  id,
  age,
  gender: "Male",
  country: "Spain",
  coffee_intake: 1,
  caffeine_mg: 100,
  sleep_hours: 7,
  sleep_quality: "Good",
  bmi: 22,
  heart_rate: 70,
  stress_level: "Low",
  physical_activity_hours: 3,
  health_issues: "None",
  occupation: "Office",
  smoking: false,
  alcohol_consumption: false,
});

/** In-memory repository with the same paging contract as the real one. */
function fakeRepo(data: CoffeeRecord[], count = { count: data.length, exact: true }) {
  const calls = { count: [] as Filters[] };
  const repo: CoffeeRecordRepository = {
    async findPage(req: PageRequest) {
      const { column, dir } = req.sort;
      const sign = dir === "asc" ? 1 : -1;
      const cmp = (a: CoffeeRecord, b: CoffeeRecord) =>
        sign * (a[column] - b[column] || a.id - b.id);
      const sorted = [...data].sort(cmp);
      if (req.mode === "offset") return sorted.slice(req.offset, req.offset + req.limit);
      const key = { ...record(req.cursor.id, 0), [column]: req.cursor.v, id: req.cursor.id };
      if (req.nav === "next") return sorted.filter((r) => cmp(r, key) > 0).slice(0, req.limit);
      return sorted.filter((r) => cmp(r, key) < 0).slice(-req.limit);
    },
    async countEstimate(filters: Filters) {
      calls.count.push(filters);
      return count;
    },
  };
  return { repo, calls };
}

// 60 rows; ages repeat so sorting by age has ties across page boundaries.
const data = Array.from({ length: 60 }, (_, i) => record(i + 1, 20 + (i % 7)));
const byAge = parseListQuery({ sort: "age" });
const ids = (rows: CoffeeRecord[]) => rows.map((r) => r.id);

const nextQuery = (q: ListQuery, page: number, c: Cursor | null): ListQuery => ({
  ...q,
  page,
  cursor: { token: c!, nav: "next" },
});

describe("listCoffeeRecords", () => {
  it("returns the first page with a next cursor", async () => {
    const { repo } = fakeRepo(data);
    const page = await listCoffeeRecords(repo, byAge);
    expect(page.rows).toHaveLength(25);
    expect(page).toMatchObject({ page: 1, hasNext: true, hasPrev: false, totalPages: 3 });
    const last = page.rows[24];
    expect(page.nextCursor).toEqual({ v: last.age, id: last.id, s: "age", d: "asc" });
  });

  it("keyset next equals offset page 2, ties included", async () => {
    const { repo } = fakeRepo(data);
    const p1 = await listCoffeeRecords(repo, byAge);
    const viaCursor = await listCoffeeRecords(repo, nextQuery(byAge, 2, p1.nextCursor));
    const viaOffset = await listCoffeeRecords(repo, { ...byAge, page: 2 });
    expect(ids(viaCursor.rows)).toEqual(ids(viaOffset.rows));
    expect(new Set([...ids(p1.rows), ...ids(viaCursor.rows)]).size).toBe(50);
  });

  it("prev cursor from page 3 returns page 2 in display order", async () => {
    const { repo } = fakeRepo(data);
    const p3 = await listCoffeeRecords(repo, { ...byAge, page: 3 });
    const back = await listCoffeeRecords(repo, {
      ...byAge,
      page: 2,
      cursor: { token: p3.prevCursor!, nav: "prev" },
    });
    const p2 = await listCoffeeRecords(repo, { ...byAge, page: 2 });
    expect(ids(back.rows)).toEqual(ids(p2.rows));
    expect(back).toMatchObject({ page: 2, hasNext: true, hasPrev: true });
  });

  it("prev that reaches the start reports page 1 without a prev link", async () => {
    const { repo } = fakeRepo(data);
    const p2 = await listCoffeeRecords(repo, { ...byAge, page: 2 });
    const back = await listCoffeeRecords(repo, {
      ...byAge,
      page: 2,
      cursor: { token: p2.prevCursor!, nav: "prev" },
    });
    expect(back).toMatchObject({ page: 1, hasPrev: false });
    expect(back.rows).toHaveLength(25);
  });

  it("last page has no next link", async () => {
    const { repo } = fakeRepo(data);
    const p3 = await listCoffeeRecords(repo, { ...byAge, page: 3 });
    expect(p3.rows).toHaveLength(10);
    expect(p3).toMatchObject({ hasNext: false, nextCursor: null, totalPages: 3 });
  });

  it("a jump past the real end returns no rows and no prev/next links", async () => {
    const { repo } = fakeRepo(data.slice(0, 30));
    const page = await listCoffeeRecords(repo, { ...byAge, page: 999 });
    expect(page).toMatchObject({
      rows: [],
      hasNext: false,
      hasPrev: false,
      nextCursor: null,
      prevCursor: null,
      totalPages: 2,
    });
  });

  it("a next cursor always has a page behind it, whatever the URL page says", async () => {
    const { repo } = fakeRepo(data);
    const p1 = await listCoffeeRecords(repo, byAge);
    // Hand-edited URL: cursor kept, page param dropped (parses as 1).
    const page = await listCoffeeRecords(repo, nextQuery(byAge, 1, p1.nextCursor));
    expect(page.hasPrev).toBe(true);
    expect(page.prevCursor).not.toBeNull();
  });

  it("corrects an overestimated total once the real last page is seen", async () => {
    const { repo } = fakeRepo(data.slice(0, 30), { count: 500, exact: false });
    const p2 = await listCoffeeRecords(repo, { ...byAge, page: 2 });
    expect(p2).toMatchObject({ totalPages: 2, total: 30, totalIsExact: true });
  });

  it("extends an underestimated total while more rows exist", async () => {
    const { repo } = fakeRepo(data, { count: 10, exact: false });
    const p1 = await listCoffeeRecords(repo, byAge);
    expect(p1.totalPages).toBe(2);
  });

  it("counts with filters only, never the cursor position", async () => {
    const { repo, calls } = fakeRepo(data);
    const q = parseListQuery({ sort: "age", gender: "Male" });
    const p1 = await listCoffeeRecords(repo, q);
    await listCoffeeRecords(repo, nextQuery(q, 2, p1.nextCursor));
    expect(calls.count).toEqual([q.filters, q.filters]);
  });
});

describe("listCoffeeRecords total", () => {
  it("never reports fewer records than the rows already reached", async () => {
    const { repo } = fakeRepo(data, { count: 30, exact: false });
    const p2 = await listCoffeeRecords(repo, { ...byAge, page: 2 });
    // Rows 26–50 are on screen and more exist: the total must exceed 50.
    expect(p2.total).toBeGreaterThan(50);
  });
});
