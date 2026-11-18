import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv, toInsertStatements } from "./csv.ts";
import type { CoffeeRecord } from "./record.ts";

const HEADER =
  "ID,Age,Gender,Country,Coffee_Intake,Caffeine_mg,Sleep_Hours,Sleep_Quality,BMI,Heart_Rate,Stress_Level,Physical_Activity_Hours,Health_Issues,Occupation,Smoking,Alcohol_Consumption";

const row = (id: number, overrides: Partial<CoffeeRecord> = {}): CoffeeRecord => ({
  id,
  age: 40,
  gender: "Male",
  country: "Germany",
  coffee_intake: 3.5,
  caffeine_mg: 328.1,
  sleep_hours: 7.5,
  sleep_quality: "Good",
  bmi: 24.9,
  heart_rate: 78,
  stress_level: "Low",
  physical_activity_hours: 14.5,
  health_issues: "None",
  occupation: "Other",
  smoking: false,
  alcohol_consumption: false,
  ...overrides,
});

describe("parseCsv", () => {
  it("parses CRLF rows into typed records", () => {
    const text = [
      HEADER,
      "1,40,Male,Germany,3.5,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0,0",
      "2,33,Female,South Korea,1.0,94.1,6.2,Fair,20.0,67,Medium,11.0,Mild,Service,1,1",
      "",
    ].join("\r\n");

    expect(parseCsv(text)).toEqual([
      row(1),
      row(2, {
        age: 33,
        gender: "Female",
        country: "South Korea",
        coffee_intake: 1,
        caffeine_mg: 94.1,
        sleep_hours: 6.2,
        sleep_quality: "Fair",
        bmi: 20,
        heart_rate: 67,
        stress_level: "Medium",
        physical_activity_hours: 11,
        health_issues: "Mild",
        occupation: "Service",
        smoking: true,
        alcohol_consumption: true,
      }),
    ]);
  });

  it("rejects an invalid row with its line number", () => {
    const text = [
      HEADER,
      "1,40,Robot,Germany,3.5,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0,0",
    ].join("\n");
    expect(() => parseCsv(text)).toThrow(/line 2/);
  });

  it("rejects a smoking flag other than 0/1", () => {
    const text = [
      HEADER,
      "1,40,Male,Germany,3.5,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,2,0",
    ].join("\n");
    expect(() => parseCsv(text)).toThrow(/line 2/);
  });

  it.each([
    ["an extra cell", "1,40,Male,Germany,3.5,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0,0,1"],
    ["a missing cell", "1,40,Male,Germany,3.5,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0"],
    ["a blank numeric cell", "1,40,Male,Germany, ,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0,0"],
    ["a hex number", "1,0x10,Male,Germany,3.5,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0,0"],
    ["more decimals than the column scale", "1,40,Male,Germany,3.55,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0,0"],
  ])("rejects a row with %s", (_label, line) => {
    expect(() => parseCsv([HEADER, line].join("\n"))).toThrow(/line 2/);
  });

  it("accepts a UTF-8 BOM before the header", () => {
    const text = "\uFEFF" + [HEADER, "1,40,Male,Germany,3.5,328.1,7.5,Good,24.9,78,Low,14.5,None,Other,0,0"].join("\n");
    expect(parseCsv(text)).toEqual([row(1)]);
  });

  it("rejects an unexpected header", () => {
    expect(() => parseCsv("id,age\n1,2")).toThrow(/header/i);
  });
});

describe("toInsertStatements", () => {
  it("batches rows into multi-row inserts inside one transaction", () => {
    const sql = toInsertStatements([row(1), row(2), row(3)], 2);
    expect(sql.startsWith("begin;\n")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql.match(/insert into public\.coffee_health_records/g)).toHaveLength(2);
  });

  it("renders literals: quoted text, bare numbers, boolean keywords", () => {
    const sql = toInsertStatements([row(7, { country: "UK", smoking: true })]);
    expect(sql).toContain(
      "(7, 40, 'Male', 'UK', 3.5, 328.1, 7.5, 'Good', 24.9, 78, 'Low', 14.5, 'None', 'Other', true, false)",
    );
  });

  it("rejects a non-positive batch size", () => {
    expect(() => toInsertStatements([row(1)], 0)).toThrow(/batch/i);
  });

  it("escapes single quotes in text", () => {
    // Not in the dataset today, but the generator must not emit broken SQL.
    const sql = toInsertStatements([row(1, { country: "O'Land" as CoffeeRecord["country"] })]);
    expect(sql).toContain("'O''Land'");
  });
});

describe("committed seed", () => {
  it("matches what the generator produces from the CSV", () => {
    const normalise = (t: string) => t.replace(/\r\n/g, "\n");
    const seed = normalise(readFileSync("supabase/seed.sql", "utf8"));
    const generated = toInsertStatements(
      parseCsv(readFileSync("data/synthetic_coffee_health_10000.csv", "utf8")),
    );
    // First line is the generator's header comment.
    expect(seed.slice(seed.indexOf("\n") + 1)).toBe(generated);
  });
});
