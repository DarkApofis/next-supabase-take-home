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
