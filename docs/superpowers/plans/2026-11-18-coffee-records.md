# Coffee Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the 10k coffee/health CSV into local Supabase and serve it at `/records` as a server-filtered, hybrid keyset/offset paginated, accessible table, with measured 1M-row performance evidence.

**Architecture:** `domain/` (zod URL contract, option lists, cursor) → `application/` (use case + repository port) → `infrastructure/` (PostgREST repository) → `app/records` (Server Component). Client code only for the filters panel (URL updates in `useTransition`).

**Tech Stack:** Next 16.2.6, React 19.2.6, TypeScript strict, Supabase local (PG 17), @supabase/ssr 0.10.3, @supabase/supabase-js 2.106.2, zod (pinned at install), Vitest 4, Tailwind 3 + shadcn `components/ui/*`.

**Spec:** `docs/superpowers/specs/2026-11-18-coffee-records-design.md`

## Global Constraints

- TypeScript strict, no `any`; no TS `enum`/namespaces in `domain/` (Node type-stripping runs it).
- Before every commit: `pnpm lint && pnpm test:run && pnpm build` green, then `/code-review` on the staged diff; fix confirmed findings.
- Conventional commit messages, **no** `Co-Authored-By`/`Claude-Session`/"Generated with" trailers; verify with `git log -1 --format=%B`, amend if one slipped in. Never push.
- Page size 25. PostgREST `max_rows = 1000`.
- Sortable whitelist: `id, age, coffee_intake, caffeine_mg, sleep_hours, bmi, heart_rate`. Default sort `id asc`.
- Option lists come from `domain/coffee-records/options.ts` only — never `SELECT DISTINCT`.
- Anon role gets `SELECT` only on the new table.

## Review Focus

1. Malformed URL params (`page=abc`, `page=-3`, `age_min=50&age_max=20`, `sort=drop_table`, garbage `cursor`, unknown enum value) → silently normalised to defaults, never a 500. Test: Task 6.
2. Ties on the sort value across a page boundary (hundreds of rows share `age=40`) → paging Next never repeats or skips a row. Test: Task 10 integration.
3. Prev via cursor from page 3 returns exactly the page-2 rows in display order. Test: Task 9 (unit) + Task 10 (integration).
4. Numbered jump past the real end (estimate too high) → empty state + "Go to first page", not an error. Test: Task 9.
5. Any filter/sort change while on page 7 with a cursor → page 1, cursor dropped. Test: Task 6 (`withQueryChange`).

---

### Task 1: chore — `.env.example` and `.gitignore` order

**Files:** Create `.env.example`; Modify `.gitignore`

- [ ] `.env.example` contains the three keys from README with empty values.
- [ ] `.gitignore`: `.env*` before `!.env.example`; remove the `supabase/config.toml` and `supabase/seed.sql` lines (both are tracked and the seed becomes committed output).
- [ ] Verify: `git check-ignore .env.example` prints nothing; `git check-ignore .env.local` prints `.env.local`.
- [ ] Gates + `/code-review` → commit `chore: add .env.example and fix gitignore negation order`.

### Task 2: chore — single lockfile

- [ ] `git rm package-lock.json`; gates; `/code-review`; commit `chore: remove npm lockfile, pnpm is canonical`.

### Task 3: chore — pin dependencies, align eslint-config-next

**Files:** Modify `package.json`, `pnpm-lock.yaml`, possibly `eslint.config.mjs`

- [ ] Replace `latest`: `next` → `16.2.6`, `@supabase/ssr` → `0.10.3`, `@supabase/supabase-js` → `2.106.2`; `eslint-config-next` → `16.2.6`.
- [ ] `pnpm install`. If `pnpm lint` fails under FlatCompat, switch `eslint.config.mjs` to the package's native flat exports (`eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`) and drop `@eslint/eslintrc` if unused.
- [ ] Gates; `/code-review`; commit `chore: pin latest deps and align eslint-config-next with next 16`.

### Task 4: chore — ignore Supabase CLI state

- [ ] Add `supabase/.branches` and `supabase/.temp` to `.gitignore`; `git rm -r --cached supabase/.branches supabase/.temp`.
- [ ] Gates; `/code-review`; commit `chore: untrack supabase cli state dirs`.

### Task 5: chore — remove auth proxy helper

- [ ] Delete `lib/supabase/proxy.ts`; `grep -r hasEnvVars` — delete it from `lib/utils.ts` if no other user.
- [ ] Gates; `/code-review`; commit `chore: remove unused auth proxy that redirected to missing /auth/login`.

### Task 6: feat(domain) — options, URL contract, cursor

**Files:** Create `domain/coffee-records/options.ts`, `record.ts`, `query.ts`, `cursor.ts`; tests `domain/coffee-records/query.test.ts`, `cursor.test.ts`. Add `zod` (pin exact version). Set `"allowImportingTsExtensions": true` in tsconfig; intra-domain imports use `./x.ts`.

**Interfaces (Produces):**
- `options.ts`: `GENDERS`, `COUNTRIES` (the 20 CSV values, alphabetical), `SLEEP_QUALITIES` (`Poor,Fair,Good,Excellent`), `STRESS_LEVELS` (`Low,Medium,High`), `HEALTH_ISSUES` (`None,Mild,Moderate,Severe`), `OCCUPATIONS` (`Office,Service,Student,Healthcare,Other`) as `readonly` tuples; matching union types `Gender`, `Country`, …
- `record.ts`: `type CoffeeRecord = { id; age; gender; country; coffee_intake; caffeine_mg; sleep_hours; sleep_quality; bmi; heart_rate; stress_level; physical_activity_hours; health_issues; occupation; smoking: boolean; alcohol_consumption: boolean }` (numbers for numerics), and `coffeeRecordSchema` (zod).
- `query.ts`:
  - `SORT_COLUMNS`, `type SortColumn`, `PAGE_SIZE = 25`
  - `type Range = { min?: number; max?: number }`
  - `type Filters = { country: Country[]; gender: Gender[]; sleep_quality; stress_level; occupation; health_issues (arrays); age: Range; coffee_intake: Range; caffeine_mg: Range; bmi: Range; sleep_hours: Range; smoking?: boolean; alcohol_consumption?: boolean }`
  - `type ListQuery = { filters: Filters; sort: { column: SortColumn; dir: "asc" | "desc" }; page: number; cursor?: { token: Cursor; nav: "next" | "prev" } }`
  - `parseListQuery(sp: Record<string, string | string[] | undefined>): ListQuery`
  - `toSearchParams(q: ListQuery): URLSearchParams` (omits defaults/empties; multi-selects comma-joined; ranges as `<col>_min`/`<col>_max`)
  - `withQueryChange(q: ListQuery, change: Partial<Pick<ListQuery, "filters" | "sort">>): ListQuery` → page 1, no cursor
- `cursor.ts`: `type Cursor = { v: number; id: number }`, `encodeCursor(c: Cursor): string` (base64url JSON), `decodeCursor(s: string): Cursor | null`.

- [ ] Write failing tests:
  - `parseListQuery({})` deep-equals defaults (empty arrays, `{}` ranges, `sort {id, asc}`, `page 1`, no cursor).
  - `country: "Spain,France,Atlantis"` → `["Spain","France"]`; `health_issues: "None"` → `["None"]`.
  - `age_min: "50", age_max: "20"` → `{ min: 20, max: 50 }` (swapped); `age_min: "abc"` → `{}`.
  - `page: "abc"` / `"-3"` / `"0"` → `1`; `sort: "drop_table"` → `id`; `dir: "sideways"` → `asc`.
  - `smoking: "true"` → `true`, `"false"` → `false`, `"maybe"` → `undefined`.
  - `cursor` present without `nav` → no cursor; garbage `cursor` with `nav=next` → no cursor.
  - `parseListQuery(Object.fromEntries(toSearchParams(q)))` round-trips a fully populated query.
  - `withQueryChange` on `{page: 7, cursor}` → `page 1`, `cursor` undefined.
  - cursor: round-trip `{v: 40.5, id: 9}`; `decodeCursor("not-base64!")`, `decodeCursor(base64url('{"v":"x","id":1}'))` → `null`.
- [ ] Run `pnpm test:run domain` → FAIL (modules missing).
- [ ] Implement with zod `safeParse`/`catch` per field so one bad param never invalidates the rest.
- [ ] Run → PASS. Gates; `/code-review`; commit `feat(domain): add typed filter/sort URL contract and keyset cursor`.

### Task 7: feat(db) — table, enums, RLS, grants, statistics

**Files:** Create `supabase/schemas/coffee_health_records.sql`; generated `supabase/migrations/<ts>_create_coffee_health_records.sql`; Delete `supabase/schemas/notes.sql`; Modify `supabase/seed.sql` (remove notes inserts); generated `lib/supabase/database.types.ts`.

- [ ] Write the declarative schema per spec "Schema" section (enum order exactly as in `options.ts`; country CHECK lists the same 20 values; CHECK ranges; RLS; `revoke all … from anon, authenticated`; `grant select … to anon, authenticated`; select policy; `create statistics coffee_sleep_stress_stats (dependencies, mcv) on sleep_quality, stress_level from …`). No sort indexes yet (added in Task 12 with evidence).
- [ ] Drop notes: delete schema file, then `pnpx supabase db diff -f create_coffee_health_records` (Docker running). Inspect migration: must drop `notes`, contain no grants beyond select. Hand-edit if diff emits blanket grants.
- [ ] `pnpx supabase db reset` succeeds.
- [ ] Verify privileges: `docker exec supabase_db_<project_id> psql -U postgres -c "select privilege_type from information_schema.role_table_grants where table_name='coffee_health_records' and grantee='anon'"` → only `SELECT`.
- [ ] `pnpx supabase gen types typescript --local > lib/supabase/database.types.ts`; add `db:types` script. Add a type-level check in `domain/coffee-records/record.ts`'s consumer (Task 10) — not here.
- [ ] Gates; `/code-review`; commit `feat(db): add coffee_health_records schema with enums, checks and read-only RLS`.

### Task 8: feat(import) — seed generator + count verification

**Files:** Create `domain/coffee-records/csv.ts`, `domain/coffee-records/csv.test.ts`, `scripts/generate-seed.ts`, `vitest.integration.config.mts`, `tests/integration/seed.int.test.ts`; Modify `vitest.config.mts` (exclude `**/*.int.test.ts`), `package.json` (`seed:generate`, `test:int`), `supabase/seed.sql` (generated).

**Interfaces (Produces):** `parseCsv(text: string): CoffeeRecord[]` (throws with line number on invalid row), `toInsertStatements(rows: CoffeeRecord[], batchSize = 1000): string`.

- [ ] Failing tests: `parseCsv` on a 2-row CRLF fixture yields typed records (`smoking: false`, `health_issues: "None"`, `caffeine_mg: 328.1`); a row with `Gender=Robot` throws mentioning line 2; `toInsertStatements` with 3 rows and batchSize 2 yields 2 `insert` statements wrapped in `begin;`/`commit;`, strings single-quote-escaped, booleans as `true/false`.
- [ ] Implement; `scripts/generate-seed.ts` reads `data/synthetic_coffee_health_10000.csv`, writes `supabase/seed.sql` with a header comment "generated by pnpm seed:generate — do not edit". Script: `"seed:generate": "node scripts/generate-seed.ts"`.
- [ ] `pnpm seed:generate && pnpx supabase db reset`.
- [ ] Integration config: `environment: "node"`, include `tests/integration/**/*.int.test.ts`, `process.loadEnvFile(".env.local")` in a setup file. Test: anon client `select("*", { count: "exact", head: true })` → `count === 10000`.
- [ ] `pnpm test:int` → PASS. Gates; `/code-review`; commit `feat(import): generate batched seed from csv and verify 10k rows`.

### Task 9: feat(application) — listCoffeeRecords use case

**Files:** Create `application/coffee-records/list-coffee-records.ts`, `list-coffee-records.test.ts`.

**Interfaces (Produces):**
```ts
type PageRequest = { filters: Filters; sort: ListQuery["sort"]; limit: number }
  & ({ mode: "offset"; offset: number } | { mode: "keyset"; cursor: Cursor; nav: "next" | "prev" });
interface CoffeeRecordRepository {
  findPage(req: PageRequest): Promise<CoffeeRecord[]>; // rows in display order
  countEstimate(filters: Filters): Promise<{ count: number; exact: boolean }>;
}
type RecordsPage = { rows: CoffeeRecord[]; page: number; totalPages: number; total: number; totalIsExact: boolean;
  hasNext: boolean; hasPrev: boolean; nextCursor: string | null; prevCursor: string | null };
listCoffeeRecords(repo: CoffeeRecordRepository, q: ListQuery): Promise<RecordsPage>
```
Behaviour: requests `limit = PAGE_SIZE + 1` and runs `findPage` and `countEstimate` in parallel. Offset mode: `offset = (page-1)*PAGE_SIZE`. `hasNext` = extra row present (for `nav=prev`: always true). For `nav=prev` the extra row (if any) is dropped from the **start**. `hasPrev = page > 1`. Cursors built from first/last displayed row: `{ v: row[sort.column], id: row.id }`. `totalPages = max(1, ceil(total / PAGE_SIZE))`.

- [ ] Failing tests with an in-memory fake repo (sorts/filters an array): page 1 offset → 25 rows, `hasNext`, `nextCursor` decodes to row 25; keyset next from page 1's cursor equals offset page 2; prev cursor from page 3 equals page 2 rows in order; page 999 on 30 rows → `rows: []`, `totalPages 2`, no throw; last page `hasNext false`; `countEstimate` called with filters only (no cursor).
- [ ] Implement → PASS. Gates; `/code-review`; commit `feat(app): add listCoffeeRecords use case with hybrid keyset/offset paging`.

### Task 10: feat(infra) — Supabase repository

**Files:** Create `infrastructure/supabase/coffee-record-repository.ts`, `filter-ops.ts`, `filter-ops.test.ts`, `tests/integration/repository.int.test.ts`.

**Interfaces (Produces):**
- `type FilterOp = { op: "in" | "gte" | "lte" | "gt" | "lt" | "eq" | "or"; column: string; value: unknown }`
- `buildFilterOps(filters: Filters): FilterOp[]`, `buildKeysetOps(sort, cursor: Cursor, nav): { ops: FilterOp[]; ascending: boolean }`
- `createCoffeeRecordRepository(client: SupabaseClient<Database>): CoffeeRecordRepository`

Keyset op for asc/next: `gte(col, v)` + `or("col.gt.v,and(col.eq.v,id.gt.id)")`; desc mirrors with `lte/lt`; `nav=prev` inverts comparisons and `ascending`, repository reverses rows. For `sort=id`: single `gt/lt` on id. Count: `.select("*", { count: "estimated", head: true })`; `exact = count <= 1000` (`// shortcut: relies on PostgREST using exact count below max_rows; revisit if max_rows changes`). Repository asserts `Database` row type is assignable to `CoffeeRecord` via a `satisfies`/type test.

- [ ] Failing unit tests on `buildFilterOps` (empty filters → `[]`; `country ["Spain"]` → `in`; `age {min:20}` → single `gte`; `smoking false` → `eq false`) and `buildKeysetOps` (asc/next, desc/next, asc/prev, id-sort strings exactly).
- [ ] Failing integration tests: `country=Spain` count equals CSV count (486); sort `age asc`: walking 5 pages via `nextCursor` yields 125 distinct ids identical to offset pages 1–5 (ties); prev from page 3 cursor equals page 2.
- [ ] Implement; wire `app` to use `createClient()` from `lib/supabase/server.ts`.
- [ ] `pnpm test:run && pnpm test:int` → PASS. Gates; `/code-review`; commit `feat(infra): add postgrest repository with keyset and offset paging`.

### Task 11: feat(ui) — `/records` page

Use **ui-ux-pro-max** skill for layout/a11y/states before writing components.

**Files:** Create `app/records/page.tsx`, `loading.tsx`, `error.tsx`; `components/molecules/{range-filter,multi-select-filter,boolean-filter,pagination-controls,active-filter-chips}.tsx`; `components/organisms/{filters-panel,data-table}.tsx`; `components/templates/dashboard-template.tsx`; Modify `app/page.tsx` (→ `redirect("/records")`).

- `page.tsx`: `await searchParams` → `parseListQuery` → `listCoffeeRecords(createCoffeeRecordRepository(await createClient()), q)` → template. Wrap table in `<Suspense key={toSearchParams(q).toString()} fallback={<TableSkeleton/>}>`.
- `FiltersPanel` ("use client"): holds `ListQuery` from props, on change `router.replace("/records?" + toSearchParams(withQueryChange(...)), { scroll: false })` inside `startTransition`; ranges debounced 300 ms; shows pending indicator (`aria-busy`).
- `DataTable`: `<th scope="col">`, sortable headers are `<Link>`s with `aria-sort` on the `<th>`, sticky header, `overflow-x-auto` wrapper, `tabular-nums`, caption (sr-only) with result summary.
- `PaginationControls`: `<nav aria-label="Pagination">`, Prev/Next links carry `cursor`+`nav`; numbered links (1, current±2, last) carry only `page`; `aria-current="page"`; last label prefixed "≈" when `!totalIsExact`.
- Empty state: "No records match these filters" + "Clear filters" link; past-end variant "Go to first page".
- [ ] Component test `components/molecules/pagination-controls.test.tsx`: renders "≈" when inexact; Next href contains `nav=next&cursor=`; page link hrefs have no `cursor`; no Next link when `hasNext=false`.
- [ ] Manual check via `pnpm dev`: filter, sort, paginate, back button restores state, mobile width 375px, dark mode, keyboard-only through filters.
- [ ] Gates; `/code-review`; commit `feat(ui): add filterable, sortable, paginated records table`.

### Task 12: perf — 1M benchmark and evidence-based indexes

**Files:** Create `scripts/bench/seed-1m.sql`, `scripts/bench/explain.sql`, `scripts/bench/run.sh`, `supabase/schemas/coffee_health_records.sql` (indexes), generated migration `<ts>_add_coffee_health_records_indexes.sql`.

- [ ] `seed-1m.sql`: `insert … select (r.id + g*10000), …jittered numerics clamped to CHECK ranges… from coffee_health_records r cross join generate_series(1, 99) g; analyze;`.
- [ ] `explain.sql`: `explain (analyze, buffers)` for: default page 1; `sort=caffeine_mg desc` page 1; keyset page ~2000; offset page 2000; `country in (Spain,France) & age 20–40 sort age`; `health_issues=Severe`; estimated count with 3 filters.
- [ ] Run before indexes → save output to `docs/bench/before.txt`.
- [ ] Add `(col, id)` indexes for the 6 sortable columns + candidates (`(country, age, id)`, partial `where health_issues='Severe'`); generate migration; re-run → `docs/bench/after.txt`. Drop any candidate EXPLAIN doesn't use or doesn't speed up.
- [ ] If keyset `or` form shows a filter instead of an index condition beyond the `gte` bound causing large row discards, note it; switch to RPC only if latency is materially worse than offset page 2.
- [ ] Clean back to 10k with `pnpx supabase db reset`; `pnpm test:int` PASS. Gates; `/code-review`; commit `perf(db): add sort/keyset indexes justified by 1M-row explain plans`.

### Task 13: docs — NOTES.md + README

- [ ] `NOTES.md` sections per spec "NOTES.md" list, with numbers and trimmed plans from `docs/bench/*`.
- [ ] README: add "Submission" section — setup commands, `/records`, `pnpm test:int`, bench instructions, link to NOTES.md.
- [ ] Gates; `/code-review`; commit `docs: add notes on schema, import, filtering and scale trade-offs`.
