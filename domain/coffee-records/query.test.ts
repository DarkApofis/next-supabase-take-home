import { describe, expect, it } from "vitest";
import { encodeCursor } from "./cursor.ts";
import {
  type ListQuery,
  parseListQuery,
  toSearchParams,
  withQueryChange,
} from "./query.ts";

const defaults: ListQuery = {
  filters: {
    country: [],
    gender: [],
    sleep_quality: [],
    stress_level: [],
    occupation: [],
    health_issues: [],
    age: {},
    coffee_intake: {},
    caffeine_mg: {},
    bmi: {},
    sleep_hours: {},
  },
  sort: { column: "id", dir: "asc" },
  page: 1,
};

describe("parseListQuery", () => {
  it("returns defaults for empty params", () => {
    expect(parseListQuery({})).toEqual(defaults);
  });

  it("keeps known multi-select values and drops unknown ones", () => {
    const q = parseListQuery({ country: "Spain,France,Atlantis" });
    expect(q.filters.country).toEqual(["Spain", "France"]);
  });

  it("accepts repeated params as multi-select values", () => {
    const q = parseListQuery({ gender: ["Male", "Other"] });
    expect(q.filters.gender).toEqual(["Male", "Other"]);
  });

  it("treats the literal 'None' as a health_issues category", () => {
    expect(parseListQuery({ health_issues: "None" }).filters.health_issues).toEqual([
      "None",
    ]);
  });

  it("dedupes multi-select values", () => {
    expect(parseListQuery({ country: "Spain,Spain" }).filters.country).toEqual([
      "Spain",
    ]);
  });

  it("swaps an inverted range", () => {
    const q = parseListQuery({ age_min: "50", age_max: "20" });
    expect(q.filters.age).toEqual({ min: 20, max: 50 });
  });

  it("parses decimal ranges", () => {
    const q = parseListQuery({ bmi_min: "18.5", caffeine_mg_max: "300" });
    expect(q.filters.bmi).toEqual({ min: 18.5 });
    expect(q.filters.caffeine_mg).toEqual({ max: 300 });
  });

  it("ignores non-numeric range bounds without touching other fields", () => {
    const q = parseListQuery({ age_min: "abc", age_max: "40" });
    expect(q.filters.age).toEqual({ max: 40 });
  });

  it.each(["abc", "-3", "0", "1.5", ""])("normalises page=%j to 1", (page) => {
    expect(parseListQuery({ page }).page).toBe(1);
  });

  it("parses a valid page", () => {
    expect(parseListQuery({ page: "7" }).page).toBe(7);
  });

  it("falls back to id asc for unknown sort/dir", () => {
    expect(parseListQuery({ sort: "drop_table", dir: "sideways" }).sort).toEqual({
      column: "id",
      dir: "asc",
    });
  });

  it("accepts whitelisted sort columns", () => {
    expect(parseListQuery({ sort: "caffeine_mg", dir: "desc" }).sort).toEqual({
      column: "caffeine_mg",
      dir: "desc",
    });
  });

  it.each([
    ["true", true],
    ["false", false],
    ["maybe", undefined],
  ])("parses smoking=%s", (raw, expected) => {
    expect(parseListQuery({ smoking: raw }).filters.smoking).toBe(expected);
  });

  it("ignores a cursor without nav", () => {
    const cursor = encodeCursor({ v: 1, id: 1, s: "id", d: "asc" });
    expect(parseListQuery({ cursor }).cursor).toBeUndefined();
  });

  it("ignores a garbage cursor", () => {
    expect(parseListQuery({ cursor: "garbage!", nav: "next" }).cursor).toBeUndefined();
  });

  it.each([
    ["column", { sort: "age" }],
    ["direction", { sort: "bmi", dir: "asc" }],
  ])("drops a cursor minted for a different sort %s", (_label, sortParams) => {
    const cursor = encodeCursor({ v: 24.9, id: 77, s: "bmi", d: "desc" });
    expect(parseListQuery({ cursor, nav: "next", ...sortParams }).cursor).toBeUndefined();
  });

  it.each(["0x10", "1e3", " 18", "18abc"])("rejects non-decimal range bound %j", (raw) => {
    expect(parseListQuery({ age_min: raw }).filters.age).toEqual({});
  });

  it("accepts negative and decimal bounds", () => {
    expect(parseListQuery({ bmi_min: "-1.5" }).filters.bmi).toEqual({ min: -1.5 });
  });

  it("keeps a valid cursor with nav", () => {
    const cursor = encodeCursor({ v: 33, id: 12, s: "age", d: "asc" });
    expect(parseListQuery({ cursor, nav: "prev", page: "3", sort: "age" }).cursor).toEqual({
      token: { v: 33, id: 12, s: "age", d: "asc" },
      nav: "prev",
    });
  });
});

describe("toSearchParams", () => {
  it("omits defaults", () => {
    expect(toSearchParams(defaults).toString()).toBe("");
  });

  it("round-trips a fully populated query", () => {
    const q: ListQuery = {
      filters: {
        country: ["Spain", "South Korea"],
        gender: ["Female"],
        sleep_quality: ["Poor", "Fair"],
        stress_level: ["High"],
        occupation: ["Healthcare"],
        health_issues: ["None", "Severe"],
        age: { min: 20, max: 40 },
        coffee_intake: { min: 1.5 },
        caffeine_mg: { max: 300 },
        bmi: { min: 18.5, max: 25 },
        sleep_hours: { min: 6 },
        smoking: false,
        alcohol_consumption: true,
      },
      sort: { column: "bmi", dir: "desc" },
      page: 4,
      cursor: { token: { v: 24.9, id: 77, s: "bmi", d: "desc" }, nav: "next" },
    };
    const sp = toSearchParams(q);
    expect(parseListQuery(Object.fromEntries(sp))).toEqual(q);
  });
});

describe("withQueryChange", () => {
  it("resets page and drops the cursor when filters change", () => {
    const q: ListQuery = {
      ...defaults,
      page: 7,
      cursor: { token: { v: 1, id: 1, s: "id", d: "asc" }, nav: "next" },
    };
    const next = withQueryChange(q, {
      filters: { ...defaults.filters, gender: ["Male"] },
    });
    expect(next.page).toBe(1);
    expect(next.cursor).toBeUndefined();
    expect(next.filters.gender).toEqual(["Male"]);
  });

  it("resets page when sort changes", () => {
    const next = withQueryChange(
      { ...defaults, page: 3 },
      { sort: { column: "age", dir: "desc" } },
    );
    expect(next).toMatchObject({ page: 1, sort: { column: "age", dir: "desc" } });
  });
});
