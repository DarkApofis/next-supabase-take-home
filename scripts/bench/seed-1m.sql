-- Grows coffee_health_records from the 10k CSV rows to 1,000,000 for benchmarking.
-- Not part of `db reset`; run via scripts/bench/run.sh, undo with `pnpx supabase db reset`.
-- Copies the real rows 99 times with small numeric jitter, so the real
-- distributions survive: rare 'Severe', sleep_quality -> stress_level dependency.
begin;

insert into public.coffee_health_records
select
  r.id + g * 10000,
  least(80, greatest(18, r.age + floor(random() * 5)::int - 2))::smallint,
  r.gender,
  r.country,
  least(99.9, greatest(0, round((r.coffee_intake + (random() - 0.5) * 0.4)::numeric, 1))),
  least(999.9, greatest(0, round((r.caffeine_mg + (random() - 0.5) * 20)::numeric, 1))),
  least(24, greatest(0, round((r.sleep_hours + (random() - 0.5) * 0.4)::numeric, 1))),
  r.sleep_quality,
  least(999.9, greatest(10, round((r.bmi + (random() - 0.5) * 0.6)::numeric, 1))),
  least(250, greatest(20, r.heart_rate + floor(random() * 5)::int - 2))::smallint,
  r.stress_level,
  least(999.9, greatest(0, round((r.physical_activity_hours + (random() - 0.5) * 0.6)::numeric, 1))),
  r.health_issues,
  r.occupation,
  r.smoking,
  r.alcohol_consumption
from public.coffee_health_records r
cross join generate_series(1, 99) g
where r.id <= 10000
  -- idempotent: do nothing if the table was already grown
  and not exists (select 1 from public.coffee_health_records where id > 10000);

commit;

vacuum analyze public.coffee_health_records;
select count(*) as rows from public.coffee_health_records;
