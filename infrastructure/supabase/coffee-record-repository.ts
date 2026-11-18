import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoffeeRecordRepository,
  PageRequest,
} from "@/application/coffee-records/list-coffee-records";
import { coffeeRecordSchema } from "@/domain/coffee-records/record";
import type { Database } from "@/lib/supabase/database.types";
import { buildFilterOps, buildKeysetOps, type FilterOp } from "./filter-ops";

const TABLE = "coffee_health_records";
// Matches [api] max_rows in supabase/config.toml.
const POSTGREST_MAX_ROWS = 1000;
const rowsSchema = coffeeRecordSchema.array();

type Client = SupabaseClient<Database>;
type Query = ReturnType<ReturnType<Client["from"]>["select"]>;

function applyOps(query: Query, ops: FilterOp[]): Query {
  let q = query;
  for (const f of ops) {
    if (f.op === "or") q = q.or(f.value);
    else if (f.op === "in") q = q.in(f.column, f.value);
    else q = q[f.op](f.column, f.value);
  }
  return q;
}

/** The only module that knows about PostgREST. */
export function createCoffeeRecordRepository(client: Client): CoffeeRecordRepository {
  return {
    async findPage(req: PageRequest) {
      let q = applyOps(client.from(TABLE).select("*"), buildFilterOps(req.filters));
      let ascending = req.sort.dir === "asc";
      if (req.mode === "keyset") {
        const keyset = buildKeysetOps(req.sort, req.cursor, req.nav);
        q = applyOps(q, keyset.ops);
        ascending = keyset.ascending;
      }
      // id breaks ties so the order is total and every (col, id) cursor is unique.
      q = q.order(req.sort.column, { ascending });
      if (req.sort.column !== "id") q = q.order("id", { ascending });
      q = req.mode === "offset" ? q.range(req.offset, req.offset + req.limit - 1) : q.limit(req.limit);

      const { data, error } = await q;
      if (error) throw new Error(`findPage failed: ${error.message}`, { cause: error });
      // Validate at the boundary: the DB types country as plain text.
      const rows = rowsSchema.parse(data);
      return req.mode === "keyset" && req.nav === "prev" ? rows.reverse() : rows;
    },

    async countEstimate(filters) {
      const { count, error } = await applyOps(
        client.from(TABLE).select("*", { count: "estimated", head: true }),
        buildFilterOps(filters),
      );
      if (error) throw new Error(`countEstimate failed: ${error.message}`, { cause: error });
      const n = count ?? 0;
      // PostgREST "estimated": exact count capped at max_rows + 1, planner estimate
      // beyond that (observed: 1,407 real rows → 1001). So <= max_rows is exact.
      return { count: n, exact: n <= POSTGREST_MAX_ROWS };
    },
  };
}
