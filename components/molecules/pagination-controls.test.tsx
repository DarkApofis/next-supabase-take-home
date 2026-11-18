import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RecordsPage } from "@/application/coffee-records/list-coffee-records";
import { parseListQuery } from "@/domain/coffee-records/query";
import { PaginationControls } from "./pagination-controls";

const page = (over: Partial<RecordsPage>): RecordsPage => ({
  rows: [],
  page: 1,
  totalPages: 400,
  total: 10000,
  totalIsExact: false,
  hasNext: true,
  hasPrev: false,
  nextCursor: { v: 25, id: 25, s: "id", d: "asc" },
  prevCursor: null,
  ...over,
});

const render = (p: RecordsPage, sp: Record<string, string> = {}) => {
  const html = renderToStaticMarkup(
    <PaginationControls query={parseListQuery(sp)} result={p} />,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [...doc.querySelectorAll("a")].map((a) => ({
    text: a.textContent?.trim() ?? "",
    href: a.getAttribute("href") ?? "",
    label: a.getAttribute("aria-label") ?? "",
  }));
  return { doc, links };
};

describe("PaginationControls", () => {
  it("is a labelled navigation landmark", () => {
    const { doc } = render(page({}));
    expect(doc.querySelector("nav")?.getAttribute("aria-label")).toBe("Pagination");
  });

  it("marks an estimated last page with ≈", () => {
    const { links } = render(page({}));
    expect(links.some((l) => l.text === "≈400")).toBe(true);
  });

  it("shows an exact last page without ≈", () => {
    const { links } = render(page({ totalPages: 3, totalIsExact: true }));
    expect(links.some((l) => l.text === "3")).toBe(true);
    expect(links.some((l) => l.text.includes("≈"))).toBe(false);
  });

  it("Next follows the keyset cursor", () => {
    const { links } = render(page({}), { sort: "age" });
    const next = links.find((l) => l.label === "Next page")!;
    expect(next.href).toContain("nav=next");
    expect(next.href).toContain("cursor=");
    expect(next.href).toContain("page=2");
    expect(next.href).toContain("sort=age");
  });

  it("numbered links jump by page number only", () => {
    const { links } = render(page({ page: 5, hasPrev: true, prevCursor: { v: 101, id: 101, s: "id", d: "asc" } }), { page: "5" });
    const numbered = links.filter((l) => /^≈?\d+$/.test(l.text));
    expect(numbered.length).toBeGreaterThan(0);
    for (const l of numbered) expect(l.href).not.toContain("cursor=");
  });

  it("marks the current page and does not link it", () => {
    const { doc, links } = render(page({ page: 5, hasPrev: true }), { page: "5" });
    expect(doc.querySelector('[aria-current="page"]')?.textContent).toBe("5");
    expect(links.some((l) => l.text === "5")).toBe(false);
  });

  it("omits Next on the last page and Prev on the first", () => {
    const { links } = render(page({ hasNext: false, nextCursor: null, totalPages: 1, totalIsExact: true }));
    expect(links.find((l) => l.label === "Next page")).toBeUndefined();
    expect(links.find((l) => l.label === "Previous page")).toBeUndefined();
  });
});
