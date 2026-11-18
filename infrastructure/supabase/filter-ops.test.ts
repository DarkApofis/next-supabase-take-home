import { describe, expect, it } from "vitest";
import { parseListQuery } from "@/domain/coffee-records/query";
import { buildFilterOps, buildKeysetOps } from "./filter-ops";

const filtersOf = (sp: Record<string, string>) => parseListQuery(sp).filters;

describe("buildFilterOps", () => {
  it("emits nothing for empty filters", () => {
    expect(buildFilterOps(filtersOf({}))).toEqual([]);
  });

  it("maps multi-selects to IN", () => {
    expect(buildFilterOps(filtersOf({ country: "Spain,South Korea" }))).toEqual([
      { op: "in", column: "country", value: ["Spain", "South Korea"] },
    ]);
  });

  it("maps 'None' health issues like any other category", () => {
    expect(buildFilterOps(filtersOf({ health_issues: "None" }))).toEqual([
      { op: "in", column: "health_issues", value: ["None"] },
    ]);
  });

  it("maps a one-sided range to a single bound", () => {
    expect(buildFilterOps(filtersOf({ age_min: "20" }))).toEqual([
      { op: "gte", column: "age", value: 20 },
    ]);
  });

  it("maps a two-sided range to both bounds", () => {
    expect(buildFilterOps(filtersOf({ bmi_min: "18.5", bmi_max: "25" }))).toEqual([
      { op: "gte", column: "bmi", value: 18.5 },
      { op: "lte", column: "bmi", value: 25 },
    ]);
  });

  it("maps booleans to equality, including false", () => {
    expect(buildFilterOps(filtersOf({ smoking: "false", alcohol_consumption: "true" }))).toEqual([
      { op: "eq", column: "smoking", value: false },
      { op: "eq", column: "alcohol_consumption", value: true },
    ]);
  });
});

describe("buildKeysetOps", () => {
  const cursor = (s: "age" | "id", d: "asc" | "desc") => ({ v: 40, id: 123, s, d });

  it("asc + next seeks after (v, id) with a range bound the index can use", () => {
    expect(buildKeysetOps({ column: "age", dir: "asc" }, cursor("age", "asc"), "next")).toEqual({
      ascending: true,
      ops: [
        { op: "gte", column: "age", value: 40 },
        { op: "or", value: "age.gt.40,and(age.eq.40,id.gt.123)" },
      ],
    });
  });

  it("desc + next seeks below (v, id)", () => {
    expect(buildKeysetOps({ column: "age", dir: "desc" }, cursor("age", "desc"), "next")).toEqual({
      ascending: false,
      ops: [
        { op: "lte", column: "age", value: 40 },
        { op: "or", value: "age.lt.40,and(age.eq.40,id.lt.123)" },
      ],
    });
  });

  it("asc + prev scans backwards from (v, id)", () => {
    expect(buildKeysetOps({ column: "age", dir: "asc" }, cursor("age", "asc"), "prev")).toEqual({
      ascending: false,
      ops: [
        { op: "lte", column: "age", value: 40 },
        { op: "or", value: "age.lt.40,and(age.eq.40,id.lt.123)" },
      ],
    });
  });

  it("id sort needs a single comparison", () => {
    expect(buildKeysetOps({ column: "id", dir: "asc" }, cursor("id", "asc"), "next")).toEqual({
      ascending: true,
      ops: [{ op: "gt", column: "id", value: 123 }],
    });
  });
});

describe("buildKeysetOps on decimal columns", () => {
  it("desc + prev on bmi keeps the decimal literal intact", () => {
    expect(
      buildKeysetOps({ column: "bmi", dir: "desc" }, { v: 22.1, id: 9, s: "bmi", d: "desc" }, "prev"),
    ).toEqual({
      ascending: true,
      ops: [
        { op: "gte", column: "bmi", value: 22.1 },
        { op: "or", value: "bmi.gt.22.1,and(bmi.eq.22.1,id.gt.9)" },
      ],
    });
  });
});
