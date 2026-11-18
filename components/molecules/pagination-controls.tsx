import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { RecordsPage } from "@/application/coffee-records/list-coffee-records";
import { buttonVariants } from "@/components/ui/button";
import type { ListQuery } from "@/domain/coffee-records/query";
import { recordsHref } from "@/lib/records";
import { cn } from "@/lib/utils";

type Props = { query: ListQuery; result: RecordsPage };

/** First, last and current ±2, with gaps marked by null. */
function pageWindow(current: number, last: number): (number | null)[] {
  const pages = new Set([1, last]);
  for (let p = current - 2; p <= current + 2; p++) if (p >= 1 && p <= last) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

const pill = (active = false) =>
  cn(
    buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
    "min-w-10 tabular-nums",
  );

/**
 * Prev/Next follow keyset cursors (constant cost at any depth); numbered links
 * jump by OFFSET. The last page is prefixed with ≈ while the total is estimated.
 */
export function PaginationControls({ query, result }: Props) {
  const { page, totalPages, totalIsExact, hasPrev, hasNext, prevCursor, nextCursor } = result;
  const jump = (p: number) => recordsHref({ ...query, page: p, cursor: undefined });

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      {hasPrev && prevCursor && (
        <Link
          aria-label="Previous page"
          className={pill()}
          href={recordsHref({ ...query, page: page - 1, cursor: { token: prevCursor, nav: "prev" } })}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </Link>
      )}

      <ol className="flex flex-wrap items-center gap-1.5">
        {pageWindow(page, Math.max(totalPages, page)).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span aria-current="page" className={pill(true)}>
                  {p}
                </span>
              ) : (
                <Link className={pill()} href={jump(p)} aria-label={`Page ${p}`}>
                  {p === totalPages && !totalIsExact ? `≈${p}` : p}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>

      {hasNext && nextCursor && (
        <Link
          aria-label="Next page"
          className={pill()}
          href={recordsHref({ ...query, page: page + 1, cursor: { token: nextCursor, nav: "next" } })}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
