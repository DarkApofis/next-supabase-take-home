# Notes: coffee & health records

How to run and verify everything is in [README → Submission](README.md#submission).
Design doc and plan: `docs/superpowers/specs/`, `docs/superpowers/plans/`.

## Architecture

```
app/records (Server Component, delivery)
  └─ application/coffee-records/list-coffee-records.ts   use case + repository port
       ├─ domain/coffee-records/*                         URL contract (zod), options, cursor, CSV
       └─ infrastructure/supabase/*                       the only code that knows PostgREST
components/  atoms = shadcn ui/*, molecules, organisms, templates (atomic design)
```

- **Domain:** pure TypeScript. Imports from it use `.ts` extensions so Node can run the seed generator without a build step.
- **URL → query:** `parseListQuery` turns raw search params into a typed `ListQuery` and never throws. Unknown values are dropped, inverted ranges are swapped, integer bounds are rounded inwards and clamped to the column's CHECK range, and the page is capped at 1,000,000. A cursor minted for a different sort is ignored.
- **Use case:** `listCoffeeRecords` depends on a `CoffeeRecordRepository` interface. It is unit-tested with an in-memory fake that follows the same paging contract.
- **Composition root:** `app/records/repository.ts`. It also wraps `countEstimate` in `'use cache'` (see Counting).

## Schema

`supabase/schemas/coffee_health_records.sql` is the declarative source. Migrations are generated with `supabase db diff`.

| Column(s) | Type | Why |
| --- | --- | --- |
| `id` | `integer` PK, `check (id > 0)` | The CSV's natural key, kept so rows trace back to the source. Not identity: values come from outside the database. |
| `age`, `heart_rate` | `smallint` + CHECK ranges | Data ranges are 18–80 and 50–109. Half the size of `int`. |
| `coffee_intake`, `sleep_hours` | `numeric(3,1)` | Every value in the CSV has exactly 1 decimal place. Exact, unlike float. |
| `caffeine_mg`, `bmi`, `physical_activity_hours` | `numeric(4,1)` | Same reason, three integer digits. |
| `gender`, `sleep_quality`, `stress_level`, `health_issues`, `occupation` | Postgres enums | Closed sets of 3–5 values. Stored in 4 bytes and declared in ordinal order (Poor < Fair < Good < Excellent). |
| `country` | `text` + `CHECK (country in (…20…))` | Open-ended set. A CHECK can be rewritten in one migration, without enum ordering/rename limits. A lookup table would add a join for no benefit at 20 values. |
| `smoking`, `alcohol_consumption` | `boolean` | The CSV encodes 0/1. |

- **NOT NULL everywhere:** the CSV has no empty cells.
- **`Health_Issues`:** the literal string `"None"` (59% of rows) is a category, not a missing value, so it is an enum label, not NULL.
- **Extended statistics:** `stress_level` is a pure function of `sleep_quality` (Poor→High, Fair→Medium, Good/Excellent→Low). `CREATE STATISTICS (dependencies, mcv)` stops the planner multiplying their selectivities: as table owner, the Poor+High estimate is 96,533 rows against an actual 96,100.
- **Access:** RLS is enabled with a `SELECT using (true)` policy for `anon, authenticated`.
  - The migration revokes Supabase's default ALL grants and grants SELECT only. `db diff` doesn't emit the revoke, so it was added by hand (verified in `role_table_grants`).
  - The integration test proves that an anon DELETE fails with 42501.

## Import

- **Generator:** `pnpm seed:generate` (`scripts/generate-seed.ts`) parses the CSV with the domain zod schema, then writes `supabase/seed.sql` as 10 multi-row INSERTs of 1,000 rows inside one transaction.
- **Parser checks:** it strips a byte-order mark and rejects any row with the wrong cell count, a non-decimal number, more than one decimal place (Postgres would round it silently), or an unknown category.
- **Committed seed:** `supabase/seed.sql` is committed, so `pnpx supabase db reset` alone reproduces the data. A unit test fails if the committed seed drifts from what the generator produces.
- **No `\copy`:** the seed doesn't rely on psql `\copy` (that runs on the client, and `db reset` doesn't go through psql), and a loader script would add a step to setup.
- **Verification:** `pnpm test:int` checks `count(*) = 10000` as anon, and that a stored row equals its CSV row.

## Filtering, sorting, paging

All of it runs in Postgres. The client only ever receives 26 rows.

- **Filter state lives in the URL:**
  - Multi-select values are comma-joined, ranges use `<col>_min`/`<col>_max`, and booleans are `true`/`false`.
  - Links are shareable and the back button works, because each filter change is a `router.push`.
  - Range inputs are debounced (400 ms).
  - Updates run in `useTransition`, so the current table stays visible and interactive while the next one renders.
  - Changing any filter or sort resets to page 1 and drops the cursor.
- **Sort whitelist:** `id, age, coffee_intake, caffeine_mg, sleep_hours, bmi, heart_rate`. Every sortable column has a `(col, id)` index. `id` is always the tiebreaker, so the order is total.
- **Option lists:** come from `domain/coffee-records/options.ts`, the same values the enums and CHECK use. There is no `SELECT DISTINCT`, and no query or cache is needed for them.
- **Pagination is a hybrid**, the choice made during design:
  - **Prev/Next use keyset pagination.** The cursor is base64url JSON `{v, id, s, d}` (sort value, id, sort column, direction) from the boundary row, validated against the column's own bounds on the way back in.
    - PostgREST has no row comparison, so `(col, id) > (v, id₀)` is written as `col >= v AND (col > v OR (col = v AND id > id₀))`. The redundant `>=` gives the index a starting point.
    - Prev runs the comparison reversed and then flips the rows back into display order.
  - **Numbered links use OFFSET.** They show first, last and current ±2, labelled `≈N` while the total is an estimate.
  - **One extra row (limit 26) tells us whether a next page exists**, so no count is needed for that.
  - Once the real last page is seen, the use case replaces the estimate with the exact total and page count.

### Why keyset beats OFFSET at scale

OFFSET n makes Postgres produce and throw away n rows. Its cost grows linearly with page depth, and rows shift between pages when writes happen. Keyset pagination seeks into the `(col, id)` index at the cursor and reads 26 rows, at roughly the same cost on page 2 or page 40,000.

Measured at 1M rows (`(age, id)` index in place):

| Page ~20,000 sorted by age | Execution |
| --- | --- |
| OFFSET 499,975 | **175 ms** (index scan over 500,001 rows) |
| Keyset, PostgREST OR form | **2.5–3.9 ms** |
| Keyset, row comparison `(age,id) > (60,500000)` | **0.07 ms** |

The OR form is slower than a true row comparison because the index range starts at `age >= 60`, and rows with `age = 60` before the cursor id are filtered one by one. That's about 16k rows per age value at 1M, and it would be about 160k at 10M. A SQL function (RPC) that uses a row comparison would remove that cost. I didn't build one: about 4 ms at 1M doesn't justify a dynamic-SQL function plus a whitelist for the dynamic `ORDER BY`. The repository interface wouldn't change if I did.

Trade-offs of the hybrid:
- A deep numbered jump costs O(offset). Page numbers are capped at 1,000,000.
- The page label carried in a cursor URL comes from the URL itself, so it can drift if rows are inserted while someone is paging.

### Counting

There is no exact `count(*)` per request. PostgREST `count=estimated` runs an exact count capped at `max_rows + 1` (1001) and returns the planner's estimate above that. I verified this against a filter matching 1,407 rows, which returned 1001.

So a count of 1,000 or less is exact and labelled as such. Anything larger is shown as "≈N", and the use case never lets the total fall below the rows already reached.

The count depends only on the filters, so it's cached per filter set (`'use cache'`, `cacheLife("minutes")`). Prev/Next within one result set never re-counts. The cost of that cache is a total up to a few minutes stale after writes, which is fine for this static dataset.

What the capped count costs at 1M rows:
- Broad filters stop after 1001 matches: about 4–5 ms.
- Selective filters (fewer than 1001 matches) scan until the end of the table: about 31 ms for Moderate+Severe in Japan.

The alternatives:
- `count=planned` never scans, but its numbers are worse (see the RLS note below).
- Dropping counts entirely ("has next page" only) would also drop the numbered pages, which were a requirement.

**Finding: RLS hides column statistics from the planner for most operators.** Under RLS, Postgres only uses column statistics through operators marked *leakproof*.
- Leakproof: `texteq`, `int2eq`, `int2ge`, `booleq`.
- Not leakproof: `enum_eq`, `numeric_ge`.

Measured as `anon`:
- Poor+High is estimated at 250,000 rows. The owner sees 96,533, and the actual count is 96,100.
- Country filters are estimated correctly, because `country` is `text`.

So for enum and numeric filters, both the estimated counts and some plan choices use default selectivities. Options if this matters:
- Make the categorical columns `text + CHECK`.
- Serve counts from a `SECURITY DEFINER` function that runs as the owner.
- Since the data is entirely public, drop RLS for this table and rely on grants alone. Supabase advises against that.

## Indexes (each justified by a plan in `docs/bench/`)

The 1M-row dataset comes from `bash scripts/bench/run.sh seed`. It copies the 10k real rows 99 times with small numeric jitter, so the real distributions survive: 0.17% Severe, and the sleep→stress dependency. Plans come from `run.sh explain`, run as `anon` so RLS is in the plan. End-to-end latency comes from `run.sh http`, the median of 7 requests through PostgREST.

| Query at 1M rows | No indexes | With indexes | Plan after |
| --- | --- | --- | --- |
| Page 1, `order by id` | 0.12 ms | 0.12 ms | PK index scan |
| Page 1, sort `caffeine_mg desc` | 59.9 ms | 0.13 ms | Index Scan Backward on `(caffeine_mg, id)` |
| Keyset deep, sort age | 23.9 ms | 2.5 ms | Index Scan on `(age, id)`, `Index Cond: age >= 60` |
| OFFSET deep, sort age | 272.7 ms | 175.3 ms | still linear: the index removes the sort but not the skipped rows |
| `country in (Spain,France)`, age 20–40, sort age | 36.5 ms | 0.23 ms | `(age, id)`, country filtered while scanning the index |
| `health_issues in (Severe)` | 2.0 ms | 0.04 ms | partial index |
| Capped count, Severe + Japan | 69.0 ms | 1.4 ms | partial index |
| Capped count, 3 broad filters | 4.5 ms | 5.0 ms | seq scan stops at 1001 rows, no index needed |

The same queries end to end through PostgREST (HTTP median):

| Request | Before | After |
| --- | --- | --- |
| Sort caffeine desc | 42 ms | 4.6 ms |
| Keyset deep | 29 ms | 6.3 ms |
| Filter + sort | 40 ms | 4.7 ms |
| OFFSET deep | 208 ms | 165 ms |

Kept:
- **`(col, id)` for each of the six sortable numeric columns.** One btree serves `ORDER BY col, id LIMIT n` in both directions (backward scan), the keyset seek, and range filters on that column. Including `id` makes the order total and the cursor unique.
- **Partial index `(id) WHERE health_issues = 'Severe'`, 56 kB.** It covers the one rare category: a full scan becomes a lookup in a ~1.7k-entry index. PostgREST's `in.(Severe)` uses it (6.5 ms vs 40 ms count over HTTP). A multi-value `in.(Moderate,Severe)` can't, because the predicate isn't implied.

Measured and dropped:
- **`(country, age, id)`.** The planner preferred `(age, id)` for filter+sort, and the broad count got slower (4.1 ms without the index, 5.9 ms with it). The only gain was on rare selective counts (37 ms → 27 ms).
- **No standalone btree on low-cardinality enums or booleans** (3–5 values, each 5–60% of rows). A sort index scan with a filter, or a seq scan, beats them, and each would cost about 21 MB of write amplification.

Write-side cost: at 1M rows the indexes total about 183 MB, against a 106 MB table (`docs/bench/index-sizes.txt`). That's acceptable for a read-mostly dataset. On a hot write path I'd keep only the sorts people actually use.

For production, I'd use `CREATE INDEX CONCURRENTLY`, each in its own non-transactional migration, because a plain `CREATE INDEX` blocks writes while it builds.

## Considered and skipped

- **RPC for filtering:** PostgREST's query builder expresses every filter here. An RPC would only win on keyset row comparisons (see above).
- **Materialized view for aggregates:** the UI shows no aggregates. If it did, for example "average caffeine by country", a materialized view refreshed after imports would serve it without scanning 1M rows per request.
- **Caching option lists:** not needed, because they are static domain constants.

## At 10M+ rows

- **Keyset:** switch to the row-comparison RPC, because ties on low-cardinality sort columns grow 10×. Consider making sort columns more distinct (`(age, id)` has only 63 values to lead with).
- **Counts:** move away from counting at request time. Options are a counts table or materialized view per common filter set, refreshed after imports, or `count=planned` once statistics are made usable under RLS.
- **Partitioning:** only if there's a natural access key such as country or import batch, and queries filter on it. List-partitioning by country would let filtered queries skip partitions, but cross-partition sorts would need merge-appends. Partitioning helps maintenance (vacuum, detaching old batches) more than random filtering.
- **Read replicas** for this read-only workload, with PgBouncer/Supavisor in transaction mode in front.
- **Search engine:** a search engine (OpenSearch/Meilisearch/Typesense) once users need free-text search or facet counts across many dimensions at once. Postgres can do faceting, but every facet count is another filtered count.
- **Deep OFFSET jumps:** cap them harder, or replace them with "jump to a value" (for example "age ≥ 60"), which is a keyset seek.

## With more time

- The row-comparison keyset RPC, plus a test that every `SORT_COLUMNS` entry has a matching index.
- Fix estimates under RLS (text columns, or an owner-run count function), then re-measure `count=planned`.
- Playwright end-to-end tests: filter → URL → table, keyboard-only navigation, and a 375 px viewport. Mobile layout and dark mode were reviewed in code but not in a real mobile browser.
- A virtualised table if the page size grows, and a sticky first column on narrow screens.
- Generic, server-driven facet counts next to each filter option.
