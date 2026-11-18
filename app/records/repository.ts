import { cacheLife } from "next/cache";
import type { CoffeeRecordRepository } from "@/application/coffee-records/list-coffee-records";
import type { Filters } from "@/domain/coffee-records/query";
import { createCoffeeRecordRepository } from "@/infrastructure/supabase/coffee-record-repository";
import { createPublicClient } from "@/lib/supabase/public";

// The count depends only on the filters, so Prev/Next within a result set
// reuses it instead of re-counting on every page.
async function cachedCountEstimate(filters: Filters) {
  "use cache";
  cacheLife("minutes");
  return createCoffeeRecordRepository(createPublicClient()).countEstimate(filters);
}

/** Composition root for the records route. */
export function recordsRepository(): CoffeeRecordRepository {
  return {
    ...createCoffeeRecordRepository(createPublicClient()),
    countEstimate: cachedCountEstimate,
  };
}
