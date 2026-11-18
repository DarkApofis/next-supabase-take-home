#!/usr/bin/env bash
# Benchmark helper (local only). Usage:
#   bash scripts/bench/run.sh seed      # grow the table to 1M rows
#   bash scripts/bench/run.sh explain   # EXPLAIN ANALYZE the app's query shapes
#   bash scripts/bench/run.sh http      # end-to-end PostgREST latency (median of 7)
# Restore the 10k dataset afterwards with: pnpx supabase db reset
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_CONTAINER="supabase_db_$(grep -m1 '^project_id' supabase/config.toml | cut -d'"' -f2)"
psql_file() { docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q < "$1"; }

http() {
  set -a; source .env.local; set +a
  # Only ever benchmark the local stack, never a hosted project.
  case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
    http://127.0.0.1:*|http://localhost:*) ;;
    *) echo "refusing: NEXT_PUBLIC_SUPABASE_URL is not local" >&2; exit 1 ;;
  esac
  local base="$NEXT_PUBLIC_SUPABASE_URL/rest/v1/coffee_health_records"
  local -a cases=(
    "page1_id|select=*&order=id.asc&limit=26"
    "page1_caffeine_desc|select=*&order=caffeine_mg.desc,id.desc&limit=26"
    "keyset_deep_age|select=*&age=gte.60&or=(age.gt.60,and(age.eq.60,id.gt.500000))&order=age.asc,id.asc&limit=26"
    "offset_deep_age|select=*&order=age.asc,id.asc&offset=499975&limit=26"
    "filter_country_age|select=*&country=in.(Spain,France)&age=gte.20&age=lte.40&order=age.asc,id.asc&limit=26"
    "rare_severe|select=*&health_issues=in.(Severe)&order=id.asc&limit=26"
  )
  for c in "${cases[@]}"; do
    local name="${c%%|*}" qs="${c#*|}" times=()
    for _ in 1 2 3 4 5 6 7; do
      times+=("$(curl -s -o /dev/null -w '%{time_total}' -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" "$base?$qs")")
    done
    printf '%-22s median %s s\n' "$name" "$(printf '%s\n' "${times[@]}" | sort -n | sed -n 4p)"
  done
  local count
  count=$(curl -s -o /dev/null -D - -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Prefer: count=estimated" \
    "$base?select=*&gender=eq.Female&smoking=eq.false&country=eq.Spain&limit=0" | grep -i content-range | tr -d '\r')
  echo "estimated count header: $count"
}

case "${1:-}" in
  seed) psql_file scripts/bench/seed-1m.sql ;;
  explain) psql_file scripts/bench/explain.sql ;;
  http) http ;;
  *) echo "usage: $0 seed|explain|http" >&2; exit 1 ;;
esac
