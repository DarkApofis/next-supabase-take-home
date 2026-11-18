import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/domain/coffee-records/csv";
import { anonClient } from "./client";

const csvRows = parseCsv(readFileSync("data/synthetic_coffee_health_10000.csv", "utf8"));

describe("seeded coffee_health_records", () => {
  it("contains exactly the CSV row count", async () => {
    const { count, error } = await anonClient()
      .from("coffee_health_records")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(csvRows.length);
    expect(count).toBe(10000);
  });

  it("stores a row identical to its CSV source", async () => {
    const { data, error } = await anonClient()
      .from("coffee_health_records")
      .select("*")
      .eq("id", 3)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual(csvRows.find((r) => r.id === 3));
  });

  it("rejects writes from the anon role", async () => {
    const { error } = await anonClient()
      .from("coffee_health_records")
      .delete()
      .eq("id", -1); // matches no row: never destructive, still needs the DELETE privilege
    expect(error?.code).toBe("42501"); // insufficient_privilege
  });
});
