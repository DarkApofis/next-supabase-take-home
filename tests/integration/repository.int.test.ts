import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listCoffeeRecords } from "@/application/coffee-records/list-coffee-records";
import { parseCsv } from "@/domain/coffee-records/csv";
import { type ListQuery, parseListQuery } from "@/domain/coffee-records/query";
import { createCoffeeRecordRepository } from "@/infrastructure/supabase/coffee-record-repository";
import { anonClient } from "./client";

const csv = parseCsv(readFileSync("data/synthetic_coffee_health_10000.csv", "utf8"));
const repo = () => createCoffeeRecordRepository(anonClient());
const ids = (q: Awaited<ReturnType<typeof listCoffeeRecords>>) => q.rows.map((r) => r.id);

describe("Supabase coffee record repository", () => {
  it("filters by country and counts exactly below max_rows", async () => {
    const expected = csv.filter((r) => r.country === "Spain").length;
    const page = await listCoffeeRecords(repo(), parseListQuery({ country: "Spain" }));
    expect(page.total).toBe(expected);
    expect(page.totalIsExact).toBe(true);
    expect(page.rows.every((r) => r.country === "Spain")).toBe(true);
  });

  it("combines multi-select, range and boolean filters", async () => {
    const q = parseListQuery({
      gender: "Female",
      health_issues: "None,Mild",
      age_min: "30",
      age_max: "34",
      smoking: "false",
    });
    const expected = csv.filter(
      (r) =>
        r.gender === "Female" &&
        ["None", "Mild"].includes(r.health_issues) &&
        r.age >= 30 &&
        r.age <= 34 &&
        !r.smoking,
    ).length;
    expect(expected).toBeLessThan(1000); // stays in PostgREST's exact-count zone
    const page = await listCoffeeRecords(repo(), q);
    expect(page.total).toBe(expected);
    expect(page.totalIsExact).toBe(true);
  });

  it("marks counts above max_rows as estimates", async () => {
    const page = await listCoffeeRecords(repo(), parseListQuery({ gender: "Female" }));
    expect(page.totalIsExact).toBe(false);
    expect(page.total).toBeGreaterThan(1000);
  });

  it("walks 5 pages by cursor with ties on the sort column, identical to offset pages", async () => {
    const base = parseListQuery({ sort: "age", dir: "desc" });
    let q: ListQuery = base;
    const viaCursor: number[] = [];
    for (let p = 1; p <= 5; p++) {
      const page = await listCoffeeRecords(repo(), q);
      viaCursor.push(...ids(page));
      q = { ...base, page: p + 1, cursor: { token: page.nextCursor!, nav: "next" } };
    }
    const viaOffset: number[] = [];
    for (let p = 1; p <= 5; p++) {
      viaOffset.push(...ids(await listCoffeeRecords(repo(), { ...base, page: p })));
    }
    expect(new Set(viaCursor).size).toBe(125);
    expect(viaCursor).toEqual(viaOffset);
  });

  it("prev cursor from page 3 returns page 2", async () => {
    const base = parseListQuery({ sort: "bmi" });
    const p3 = await listCoffeeRecords(repo(), { ...base, page: 3 });
    const back = await listCoffeeRecords(repo(), {
      ...base,
      page: 2,
      cursor: { token: p3.prevCursor!, nav: "prev" },
    });
    const p2 = await listCoffeeRecords(repo(), { ...base, page: 2 });
    expect(ids(back)).toEqual(ids(p2));
  });
});
