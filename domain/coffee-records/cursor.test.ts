import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor.ts";

const b64 = (s: string) => Buffer.from(s).toString("base64url");

describe("cursor", () => {
  it("round-trips a cursor", () => {
    const c = { v: 40.5, id: 9, s: "bmi", d: "desc" } as const;
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("produces a URL-safe token", () => {
    expect(encodeCursor({ v: 780.3, id: 10000, s: "caffeine_mg", d: "asc" })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["not base64", "not-base64!"],
    ["non-JSON", b64("hello")],
    ["wrong value type", b64('{"v":"x","id":1,"s":"id","d":"asc"}')],
    ["non-integer id", b64('{"v":1,"id":1.5,"s":"id","d":"asc"}')],
    ["missing id", b64('{"v":1,"s":"id","d":"asc"}')],
    ["unknown sort column", b64('{"v":1,"id":1,"s":"drop","d":"asc"}')],
  ])("rejects %s", (_label, token) => {
    expect(decodeCursor(token)).toBeNull();
  });
});

describe("cursor value validation", () => {
  it.each([
    ["decimal value on an integer column", b64('{"v":40.5,"id":1,"s":"age","d":"asc"}')],
    ["id beyond integer range", b64('{"v":1,"id":10000000000,"s":"id","d":"asc"}')],
    ["non-positive id", b64('{"v":1,"id":0,"s":"id","d":"asc"}')],
    ["absurd sort value", b64('{"v":1e300,"id":1,"s":"bmi","d":"asc"}')],
  ])("rejects %s", (_label, token) => {
    expect(decodeCursor(token)).toBeNull();
  });

  it("accepts a decimal value on a numeric column", () => {
    expect(decodeCursor(b64('{"v":22.1,"id":5,"s":"bmi","d":"desc"}'))).toEqual({
      v: 22.1,
      id: 5,
      s: "bmi",
      d: "desc",
    });
  });
});

describe("cursor value fits its column", () => {
  it.each([
    ["age beyond smallint/CHECK range", b64('{"v":100000,"id":1,"s":"age","d":"asc"}')],
    ["heart_rate beyond CHECK range", b64('{"v":300,"id":1,"s":"heart_rate","d":"asc"}')],
    ["coffee_intake beyond numeric(3,1)", b64('{"v":1000,"id":1,"s":"coffee_intake","d":"asc"}')],
    ["negative caffeine", b64('{"v":-5,"id":1,"s":"caffeine_mg","d":"asc"}')],
  ])("rejects %s", (_label, token) => {
    expect(decodeCursor(token)).toBeNull();
  });
});

describe("id-sorted cursor", () => {
  it("rejects a token whose sort value disagrees with its id", () => {
    expect(decodeCursor(b64('{"v":5,"id":900000,"s":"id","d":"asc"}'))).toBeNull();
  });
});
