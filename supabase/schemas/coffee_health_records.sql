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
