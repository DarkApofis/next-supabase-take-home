import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listCoffeeRecords } from "@/application/coffee-records/list-coffee-records";
import { ActiveFilterChips } from "@/components/molecules/active-filter-chips";
import { PaginationControls } from "@/components/molecules/pagination-controls";
import { DataTable } from "@/components/organisms/data-table";
import { FiltersPanel } from "@/components/organisms/filters-panel";
import { DashboardTemplate } from "@/components/templates/dashboard-template";
import { buttonVariants } from "@/components/ui/button";
import {
  PAGE_SIZE,
  parseListQuery,
  type RawSearchParams,
  withQueryChange,
} from "@/domain/coffee-records/query";
import { activeFilterCount, EMPTY_FILTERS, recordsHref } from "@/lib/records";
import { recordsRepository } from "./repository";
import { RecordsSkeleton } from "./skeleton";

export const metadata: Metadata = {
  title: "Coffee & health records",
  description: "Filter and sort 10,000 synthetic coffee consumption and health records.",
};

type PageProps = { searchParams: Promise<RawSearchParams> };

const fmt = new Intl.NumberFormat("en-US");

export default function RecordsPage({ searchParams }: PageProps) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[96rem] space-y-6 px-4 py-8 sm:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Coffee &amp; health records</h1>
          <p className="text-sm text-muted-foreground">
            Synthetic survey of coffee intake, sleep and health. Filtering, sorting and paging run in
            the database.
          </p>
        </header>
        <Suspense fallback={<RecordsSkeleton />}>
          <Records searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Records({ searchParams }: PageProps) {
  const query = parseListQuery(await searchParams);
  const result = await listCoffeeRecords(recordsRepository(), query);
  const { rows, page, total, totalIsExact } = result;

  const first = (page - 1) * PAGE_SIZE + 1;
  const summary = rows.length
    ? `Showing ${fmt.format(first)}–${fmt.format(first + rows.length - 1)} of ${totalIsExact ? "" : "≈"}${fmt.format(total)} records`
    : "No records to show";

  return (
    <DashboardTemplate
      filters={<FiltersPanel query={query} />}
      activeFilterCount={activeFilterCount(query.filters)}
      summary={summary}
      chips={<ActiveFilterChips query={query} />}
    >
      {rows.length ? (
        <>
          <DataTable rows={rows} query={query} summary={summary} />
          <PaginationControls query={query} result={result} />
        </>
      ) : (
        <EmptyState pastEnd={page > 1 || query.cursor !== undefined}clearHref={recordsHref(withQueryChange(query, { filters: EMPTY_FILTERS }))} firstHref={recordsHref({ ...query, page: 1, cursor: undefined })} />
      )}
    </DashboardTemplate>
  );
}

function EmptyState({ pastEnd, clearHref, firstHref }: { pastEnd: boolean; clearHref: string; firstHref: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <h2 className="text-lg font-medium">
        {pastEnd ? "This page is past the end of the results" : "No records match these filters"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {pastEnd
          ? "The page count is an estimate, so it can point beyond the last record."
          : "Try widening a range or removing a filter."}
      </p>
      <Link href={pastEnd ? firstHref : clearHref} className={buttonVariants({ variant: "outline" })}>
        {pastEnd ? "Go to first page" : "Clear filters"}
      </Link>
    </div>
  );
}
