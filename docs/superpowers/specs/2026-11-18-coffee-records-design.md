# Coffee health records — design

## Intent

Take-home for a full-stack role (README.md is the spec). Load the 10k-row
coffee/health CSV into local Supabase and show it in a server-filtered,
server-paginated table at `/records`. Reviewers will judge schema quality,
query performance reasoning at 1M+ rows, and whether the author can defend
every choice. Code must be production-shaped but not over-engineered.

## Goals

- Reproducible setup: `pnpm install && pnpm setup:env && pnpx supabase db reset && pnpm dev`.
- Precise, constrained schema; read-only public access.
- All filtering, sorting, pagination server-side; never ship the dataset.
- Numbered pagination that stays fast for sequential browsing at 1M rows.
- Measured evidence (EXPLAIN ANALYZE, latency on 1M rows) in NOTES.md.

## Non-goals / anti-goals

- No auth, no writes, no charts/aggregates (materialized view documented, not built).
- No full-text search (documented as a 10M+ concern).
- Failure even if it "works": exact `count(*)` per request, `SELECT DISTINCT`
  for option lists, unindexed sorts, filter state outside the URL, `any` types,
  attribution trailers in commits.

## Constraints

- Next.js 16.2.6 (App Router, async `searchParams`, `proxy.ts` replaces middleware),
  React 19, Tailwind 3, shadcn ui in `components/ui/`, Supabase local (PG 17,
  PostgREST `max_rows = 1000`), Vitest 4, pnpm only, Windows dev box + Docker.
- Every commit: `pnpm lint`, `pnpm test:run`, `pnpm build` green and `/code-review`
  run on the staged diff. Conventional commits, no attribution trailers, no push.

## Data facts (from profiling)

- 10,000 rows, CRLF line endings, no empty cells, ID 1..10000 unique.
- Health_Issues literal `"None"` is a category (5,941), `Severe` only 17 rows.
- Cardinalities: gender 3 (Male/Female/Other), country 20, sleep_quality 4,
  stress_level 3, occupation 5, health_issues 4.
- Stress_Level is a pure function of Sleep_Quality (Poor→High, Fair→Medium,
  Good/Excellent→Low) → planner misestimates combined filters; add
  `CREATE STATISTICS (dependencies, mcv)` on the pair.
- Decimals all 1 dp: coffee 0–8.2, caffeine 0–780.3, sleep 3–10, bmi 15–38.2,
  activity 0–15. Age 18–80, heart rate 50–109. Smoking/alcohol 0/1.

## Approaches (pagination) — picked: A

- **A. Hybrid (picked).** `?page=N` always in URL. Prev/Next carry a keyset
  cursor (`(sort_col, id)` seek, constant cost at any depth). Direct numbered
  jump uses `OFFSET` on the same index (cost ∝ N; fine for nearby/first pages,
  documented as the deep-jump trade-off). Total pages from estimated count.
- B. Plain OFFSET everywhere — simplest, but sequential browsing degrades with depth.
- C. Keyset + small page window — no arbitrary jumps; doesn't meet the ask.

The user picked A: common path (sequential) is keyset; numbered jumps exist
with an honest, documented cost.

## Decisions

### Repo hygiene (one commit each, before features)
1. Add `.env.example` (the three vars, empty); fix `.gitignore` order
   (`.env*` then `!.env.example`). Also stop ignoring `supabase/seed.sql` and
   `supabase/config.toml` (both tracked, seed becomes generated + committed).
2. Delete `package-lock.json`.
3. Pin `latest` deps to the lockfile-resolved versions (next 16.2.6 etc.);
   bump `eslint-config-next` to 16.2.6 and migrate `eslint.config.mjs` to its
   native flat config if FlatCompat breaks.
4. Ignore + `git rm --cached` `supabase/.branches`, `supabase/.temp`.
5. Delete `lib/supabase/proxy.ts` (unused, redirects to a non-existent route).
   Remove `hasEnvVars` only if then unused.

### Schema (`supabase/schemas/coffee_health_records.sql` + migration generated
with `supabase db diff`; drop the `notes` table, schema file and seed rows)
- Table `public.coffee_health_records`, PK `id integer` (CSV ID, no identity).
- `smallint`: age, heart_rate (with CHECK ranges: age 0–130, heart_rate 20–250).
- `numeric(3,1)`: coffee_intake, sleep_hours; `numeric(4,1)`: caffeine_mg,
  bmi, physical_activity_hours. CHECK ≥ 0 (sleep ≤ 24).
- Enums: `gender`, `sleep_quality`, `stress_level`, `health_issues`, `occupation`,
  declared in ordinal order (Poor<Fair<Good<Excellent, Low<Medium<High,
  None<Mild<Moderate<Severe) so sorting by them is meaningful.
- `country text` + CHECK `country in (…20 values…)`. Justification: country set
  is open-ended (adding one = alter CHECK, no type rewrite / enum ordering
  issues); a lookup table adds a join for zero benefit at 20 values.
- `smoking`, `alcohol_consumption boolean`.
- All columns NOT NULL.
- RLS enabled; policy `for select to anon, authenticated using (true)`.
  `revoke all … from anon, authenticated; grant select … to anon, authenticated`.
- `create statistics … (dependencies, mcv) on sleep_quality, stress_level`.

### Indexes (final set decided by EXPLAIN on 1M rows; starting hypothesis)
- `(col, id)` btree for each sortable column: age, coffee_intake, caffeine_mg,
  sleep_hours, bmi, heart_rate (PK covers id). Serve both keyset seek and
  ORDER BY … LIMIT, both directions (backward scan), and range filters on col.
- Low-cardinality enum/boolean columns get **no** standalone btree unless
  EXPLAIN shows a win (selectivity ≥ ~5% → seq/index scan on sort index wins);
  candidate: partial index for rare value (`health_issues = 'Severe'`),
  and one composite for the most common filter+sort (`country, age, id`) —
  keep only what EXPLAIN justifies. Every kept index has a plan in NOTES.md.

### Import
- `scripts/generate-seed.ts` (run with `node --experimental-strip-types`,
  no new runtime dep): parse CSV (handles CRLF), validate each row with the
  domain zod schema, emit `supabase/seed.sql` as batched multi-row INSERTs
  (1,000 rows/statement) inside one transaction. Seed is committed; script
  is the source of truth (`pnpm seed:generate`). Unit-tested row mapping.
- `pnpm verify:count` / integration test asserts `count(*) = 10000`.
- 1M benchmark: `scripts/bench/seed-1m.sql` replicates the 10k real rows ×100
  (`cross join generate_series`, new ids > 10000, small numeric jitter clamped
  to domain) so real distributions and correlations (rare Severe, sleep→stress)
  survive — builder's call; then `analyze`. Run via
  `docker exec … psql`; not run by `db reset`, data not committed.
  `scripts/bench/explain.sql` with representative queries.

### Layers
- `domain/coffee-records/`: enum value lists + labels (single source for
  options), `Filters` zod schema (URL → typed), sortable column whitelist,
  cursor encode/decode (base64url JSON `{v, id}` validated by zod), page size.
- `application/list-coffee-records.ts`: `listCoffeeRecords(repo, query)` →
  `{ rows, page, hasNext, hasPrev, nextCursor, prevCursor, estimatedTotal, totalPages }`.
  Repository interface `CoffeeRecordRepository` lives in application (port).
- `infrastructure/supabase-coffee-record-repository.ts`: only file that knows
  PostgREST. Keyset expressed as `col >= v` (or `<=`) plus
  `or(col.gt.v, and(col.eq.v, id.gt.lastId))` so the planner gets an index
  range bound; Prev = reversed order + reverse rows. Offset path = `.range()`.
  Count: `count: 'estimated'` (planner estimate above `max_rows`, exact below).
  hasNext via fetching `size + 1`. If EXPLAIN shows the OR form doesn't seek
  well, replace with an RPC using row comparison `(col, id) > (v, id)` — the
  interface doesn't change.
- `app/records/page.tsx`: Server Component; awaits `searchParams`, parses with
  zod (invalid params → defaults, never 500), calls use case, renders template.
  `app/page.tsx` redirects to `/records`.
- Generated DB types: `supabase gen types typescript --local > lib/supabase/database.types.ts`.

### Filters and sorts (full set)
- Multi-select: country, gender, sleep_quality, stress_level, occupation, health_issues.
- Min/max range: age, coffee_intake, caffeine_mg, bmi, sleep_hours.
- Boolean (any/yes/no): smoking, alcohol_consumption.
- Sortable whitelist (builder's call): id, age, coffee_intake, caffeine_mg,
  sleep_hours, bmi, heart_rate — each backed by a `(col, id)` index. Enum
  columns are not sortable; their ordinal declaration order is for option
  ordering and meaningful `<`/`>` semantics, not for sorting.

### Counts past the real end (builder's call)
Total pages come from `count: 'estimated'` (exact when ≤ `max_rows` = 1000,
planner estimate above) and are labelled "≈" when estimated. A numbered jump
that lands past the real end renders the empty state with a "Go to first page"
link instead of erroring. Extended statistics reduce the misestimate on the
correlated pair. Exact-capped counts ("1,000+") are documented as the alternative.

### URL contract
`/records?country=Spain,France&gender=Male&age_min=20&age_max=40&smoking=true
&sort=caffeine_mg&dir=desc&page=3&cursor=<b64>&nav=next|prev`
- Multi-selects comma-separated; unknown values dropped.
- Any filter/sort change resets to page 1 and drops the cursor.
- Cursor only honoured together with `nav`; otherwise page → offset.
- Page size fixed at 25.

### UI (atomic, only where it removes duplication)
- molecules: `RangeFilter` (min/max inputs, debounced 300 ms),
  `MultiSelectFilter` (DropdownMenu + checkbox items), `BooleanFilter`
  (any/yes/no), `PaginationControls` (Prev, first, current±2, last ≈, Next),
  `ActiveFilterChips` (+ Clear all).
- organisms: `FiltersPanel` (client; owns URL updates via `router.replace` in
  `useTransition`, shows pending state), `DataTable` (server-rendered; `<th scope="col">`,
  sortable headers as buttons/links with `aria-sort`, sticky header, horizontal
  scroll on small screens, `tabular-nums` numbers).
- template: `DashboardTemplate` (filters sidebar on lg, collapsible above table on mobile).
- `loading.tsx` / Suspense skeleton keyed by search params, `error.tsx` with
  retry, empty state with "Clear filters". Dark mode via existing next-themes tokens.

### Tests
- Unit (Vitest, `pnpm test:run`): filter parsing (valid, invalid, ranges
  swapped, unknown enum), cursor round-trip + tamper rejection, use case with
  fake repo (hasNext/prev, page math), repository mapping (query builder
  called with expected filters — via a recording fake of the PostgREST builder),
  seed row mapping.
- Integration (`pnpm test:int`, separate vitest config, needs local Supabase):
  count = 10000, one filtered query returns expected count, keyset next page
  doesn't overlap the first.

### NOTES.md
Schema decisions, import, filtering, index rationale with EXPLAIN plans and
1M-row latency before/after, keyset vs offset, estimated vs exact count, RPC
vs PostgREST, option-list caching (static domain → no query), materialized
view (skipped, no aggregates), 10M+ (partitioning, replicas, search engine),
what's next.

## Left to the builder
Exact component markup/styling, debounce helper, bench query set, which
candidate indexes survive (by evidence), test file layout.
