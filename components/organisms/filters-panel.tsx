"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BooleanFilter } from "@/components/molecules/boolean-filter";
import { MultiSelectFilter } from "@/components/molecules/multi-select-filter";
import { RangeFilter } from "@/components/molecules/range-filter";
import {
  BOOLEAN_FILTERS,
  type Filters,
  type ListQuery,
  MULTI_FILTERS,
  type MultiFilterKey,
  RANGE_FILTERS,
  type RangeFilterKey,
  withQueryChange,
} from "@/domain/coffee-records/query";
import { LABELS, recordsHref } from "@/lib/records";

const RANGE_STEP: Record<RangeFilterKey, number> = {
  age: 1,
  coffee_intake: 0.1,
  caffeine_mg: 1,
  bmi: 0.1,
  sleep_hours: 0.1,
};

/**
 * Filter state lives in the URL. Each change pushes a new history entry
 * (shareable, back-button safe) inside a transition, so the current results
 * stay visible and interactive while the server renders the next ones.
 */
export function FiltersPanel({ query }: { query: ListQuery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local copy of the filters so changes made while a navigation is still
  // pending build on each other instead of on the stale `query` prop.
  const [filters, setFilters] = useState(query.filters);
  const [synced, setSynced] = useState(query.filters);
  if (synced !== query.filters) {
    setSynced(query.filters);
    setFilters(query.filters);
  }

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    startTransition(() => {
      router.push(recordsHref(withQueryChange(query, { filters: next })), { scroll: false });
    });
  };

  return (
    <form
      aria-label="Filters"
      aria-busy={isPending}
      className="space-y-5"
      onSubmit={(e) => e.preventDefault()}
    >
      <p role="status" aria-live="polite" className="flex h-5 items-center gap-2 text-xs text-muted-foreground">
        {isPending && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            Updating results…
          </>
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {(Object.keys(MULTI_FILTERS) as MultiFilterKey[]).map((key) => (
          <MultiSelectFilter
            key={key}
            id={`filter-${key}`}
            label={LABELS[key]}
            options={MULTI_FILTERS[key]}
            selected={filters[key]}
            onChange={(selected) => update({ [key]: selected })}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {RANGE_FILTERS.map((key) => (
          <RangeFilter
            key={key}
            id={`filter-${key}`}
            label={LABELS[key]}
            step={RANGE_STEP[key]}
            value={filters[key]}
            onChange={(range) => update({ [key]: range })}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {BOOLEAN_FILTERS.map((key) => (
          <BooleanFilter
            key={key}
            id={`filter-${key}`}
            label={LABELS[key]}
            value={filters[key]}
            onChange={(value) => update({ [key]: value })}
          />
        ))}
      </div>
    </form>
  );
}
