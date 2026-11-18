-- Declarative source of truth for the coffee/health dataset.
-- Enum value order mirrors domain/coffee-records/options.ts and is ordinal
-- where the domain has an order (Poor < Fair < Good < Excellent, ...).

create type public.gender as enum ('Female', 'Male', 'Other');
create type public.sleep_quality as enum ('Poor', 'Fair', 'Good', 'Excellent');
create type public.stress_level as enum ('Low', 'Medium', 'High');
-- 'None' is a real category in the source data, not a missing value.
create type public.health_issue as enum ('None', 'Mild', 'Moderate', 'Severe');
create type public.occupation as enum ('Office', 'Service', 'Student', 'Healthcare', 'Other');

create table public.coffee_health_records (
  -- Natural key from the CSV, kept so rows stay traceable to the source file.
  id integer primary key check (id > 0),
  age smallint not null check (age between 0 and 130),
  gender public.gender not null,
  -- text + CHECK instead of an enum: the country list is open-ended and a
  -- CHECK can be replaced without the enum ordering/rename constraints.
  country text not null check (country in (
    'Australia', 'Belgium', 'Brazil', 'Canada', 'China', 'Finland', 'France',
    'Germany', 'India', 'Italy', 'Japan', 'Mexico', 'Netherlands', 'Norway',
    'South Korea', 'Spain', 'Sweden', 'Switzerland', 'UK', 'USA'
  )),
  coffee_intake numeric(3, 1) not null check (coffee_intake >= 0),
  caffeine_mg numeric(4, 1) not null check (caffeine_mg >= 0),
  sleep_hours numeric(3, 1) not null check (sleep_hours between 0 and 24),
  sleep_quality public.sleep_quality not null,
  bmi numeric(4, 1) not null check (bmi > 0),
  heart_rate smallint not null check (heart_rate between 20 and 250),
  stress_level public.stress_level not null,
  physical_activity_hours numeric(4, 1) not null check (physical_activity_hours >= 0),
  health_issues public.health_issue not null,
  occupation public.occupation not null,
  smoking boolean not null,
  alcohol_consumption boolean not null
);

-- stress_level is functionally dependent on sleep_quality in this dataset;
-- without this the planner multiplies their selectivities and underestimates.
create statistics public.coffee_health_records_sleep_stress (dependencies, mcv)
  on sleep_quality, stress_level from public.coffee_health_records;

alter table public.coffee_health_records enable row level security;

-- Read-only public dataset: revoke Supabase's default table grants, keep SELECT.
revoke all on table public.coffee_health_records from anon, authenticated;
grant select on table public.coffee_health_records to anon, authenticated;

create policy "Public read access"
  on public.coffee_health_records
  for select
  to anon, authenticated
  using (true);

-- Sort/keyset indexes: one (col, id) btree per sortable column (SORT_COLUMNS in
-- domain/coffee-records/options.ts). Each serves ORDER BY col, id LIMIT n in
-- both directions, the keyset seek past (v, id), and range filters on col.
-- Plans and timings: docs/bench/ and NOTES.md.
create index coffee_health_records_age_id_idx on public.coffee_health_records (age, id);
create index coffee_health_records_coffee_intake_id_idx on public.coffee_health_records (coffee_intake, id);
create index coffee_health_records_caffeine_mg_id_idx on public.coffee_health_records (caffeine_mg, id);
create index coffee_health_records_sleep_hours_id_idx on public.coffee_health_records (sleep_hours, id);
create index coffee_health_records_bmi_id_idx on public.coffee_health_records (bmi, id);
create index coffee_health_records_heart_rate_id_idx on public.coffee_health_records (heart_rate, id);

-- Partial index for the one rare category (0.17% of rows): "Severe" filters and
-- selective counts go from a full scan to a ~1.7k-entry index. A (country, age, id)
-- index was measured and dropped: unused for sorting, ~10 ms gain on rare counts only.
create index coffee_health_records_severe_idx on public.coffee_health_records (id) where health_issues = 'Severe';
