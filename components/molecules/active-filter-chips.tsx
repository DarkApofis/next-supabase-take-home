import { X } from "lucide-react";
import Link from "next/link";
import {
  BOOLEAN_FILTERS,
  type Filters,
  type ListQuery,
  MULTI_FILTERS,
  type MultiFilterKey,
  RANGE_FILTERS,
  withQueryChange,
} from "@/domain/coffee-records/query";
import { EMPTY_FILTERS, LABELS, recordsHref } from "@/lib/records";

type Chip = { key: string; text: string; filters: Filters };

function chipsFor(f: Filters): Chip[] {
  const chips: Chip[] = [];
  for (const key of Object.keys(MULTI_FILTERS) as MultiFilterKey[]) {
    for (const value of f[key]) {
      chips.push({
        key: `${key}:${value}`,
        text: `${LABELS[key]}: ${value}`,
        filters: { ...f, [key]: f[key].filter((v) => v !== value) },
      });
    }
  }
  for (const key of RANGE_FILTERS) {
    const { min, max } = f[key];
    if (min === undefined && max === undefined) continue;
    const range =
      min !== undefined && max !== undefined ? `${min}–${max}` : min !== undefined ? `≥ ${min}` : `≤ ${max}`;
    chips.push({ key, text: `${LABELS[key]}: ${range}`, filters: { ...f, [key]: {} } });
  }
  for (const key of BOOLEAN_FILTERS) {
    if (f[key] === undefined) continue;
    chips.push({
      key,
      text: `${LABELS[key]}: ${f[key] ? "yes" : "no"}`,
      filters: { ...f, [key]: undefined },
    });
  }
  return chips;
}

/** Each chip is a link that removes its filter: works without JS and with the back button. */
export function ActiveFilterChips({ query }: { query: ListQuery }) {
  const chips = chipsFor(query.filters);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={recordsHref(withQueryChange(query, { filters: chip.filters }))}
          aria-label={`Remove filter ${chip.text}`}
          className="inline-flex min-h-8 items-center gap-1 rounded-full border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {chip.text}
          <X className="h-3 w-3" aria-hidden />
        </Link>
      ))}
      <Link
        href={recordsHref(withQueryChange(query, { filters: EMPTY_FILTERS }))}
        className="min-h-8 px-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}
