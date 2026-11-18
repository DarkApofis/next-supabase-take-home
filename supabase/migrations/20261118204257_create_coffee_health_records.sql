create type "public"."gender" as enum ('Female', 'Male', 'Other');

create type "public"."health_issue" as enum ('None', 'Mild', 'Moderate', 'Severe');

create type "public"."occupation" as enum ('Office', 'Service', 'Student', 'Healthcare', 'Other');

create type "public"."sleep_quality" as enum ('Poor', 'Fair', 'Good', 'Excellent');

create type "public"."stress_level" as enum ('Low', 'Medium', 'High');

drop policy "Allow public read access" on "public"."notes";

revoke delete on table "public"."notes" from "anon";

revoke insert on table "public"."notes" from "anon";

revoke references on table "public"."notes" from "anon";

revoke select on table "public"."notes" from "anon";

revoke trigger on table "public"."notes" from "anon";

revoke truncate on table "public"."notes" from "anon";

revoke update on table "public"."notes" from "anon";

revoke delete on table "public"."notes" from "authenticated";

revoke insert on table "public"."notes" from "authenticated";

revoke references on table "public"."notes" from "authenticated";

revoke select on table "public"."notes" from "authenticated";

revoke trigger on table "public"."notes" from "authenticated";

revoke truncate on table "public"."notes" from "authenticated";

revoke update on table "public"."notes" from "authenticated";

revoke delete on table "public"."notes" from "service_role";

revoke insert on table "public"."notes" from "service_role";

revoke references on table "public"."notes" from "service_role";

revoke select on table "public"."notes" from "service_role";

revoke trigger on table "public"."notes" from "service_role";

revoke truncate on table "public"."notes" from "service_role";

revoke update on table "public"."notes" from "service_role";

alter table "public"."notes" drop constraint "notes_pkey";

drop index if exists "public"."notes_pkey";

drop table "public"."notes";


  create table "public"."coffee_health_records" (
    "id" integer not null,
    "age" smallint not null,
    "gender" public.gender not null,
    "country" text not null,
    "coffee_intake" numeric(3,1) not null,
    "caffeine_mg" numeric(4,1) not null,
    "sleep_hours" numeric(3,1) not null,
    "sleep_quality" public.sleep_quality not null,
    "bmi" numeric(4,1) not null,
    "heart_rate" smallint not null,
    "stress_level" public.stress_level not null,
    "physical_activity_hours" numeric(4,1) not null,
    "health_issues" public.health_issue not null,
    "occupation" public.occupation not null,
    "smoking" boolean not null,
    "alcohol_consumption" boolean not null
      );


alter table "public"."coffee_health_records" enable row level security;

-- Hand-added: db diff does not emit extended statistics.
create statistics "public"."coffee_health_records_sleep_stress" (dependencies, mcv)
  on sleep_quality, stress_level from "public"."coffee_health_records";

drop sequence if exists "public"."notes_id_seq";

CREATE UNIQUE INDEX coffee_health_records_pkey ON public.coffee_health_records USING btree (id);

alter table "public"."coffee_health_records" add constraint "coffee_health_records_pkey" PRIMARY KEY using index "coffee_health_records_pkey";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_age_check" CHECK (((age >= 0) AND (age <= 130))) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_age_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_bmi_check" CHECK ((bmi > (0)::numeric)) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_bmi_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_caffeine_mg_check" CHECK ((caffeine_mg >= (0)::numeric)) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_caffeine_mg_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_coffee_intake_check" CHECK ((coffee_intake >= (0)::numeric)) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_coffee_intake_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_country_check" CHECK ((country = ANY (ARRAY['Australia'::text, 'Belgium'::text, 'Brazil'::text, 'Canada'::text, 'China'::text, 'Finland'::text, 'France'::text, 'Germany'::text, 'India'::text, 'Italy'::text, 'Japan'::text, 'Mexico'::text, 'Netherlands'::text, 'Norway'::text, 'South Korea'::text, 'Spain'::text, 'Sweden'::text, 'Switzerland'::text, 'UK'::text, 'USA'::text]))) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_country_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_heart_rate_check" CHECK (((heart_rate >= 20) AND (heart_rate <= 250))) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_heart_rate_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_id_check" CHECK ((id > 0)) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_id_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_physical_activity_hours_check" CHECK ((physical_activity_hours >= (0)::numeric)) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_physical_activity_hours_check";

alter table "public"."coffee_health_records" add constraint "coffee_health_records_sleep_hours_check" CHECK (((sleep_hours >= (0)::numeric) AND (sleep_hours <= (24)::numeric))) not valid;

alter table "public"."coffee_health_records" validate constraint "coffee_health_records_sleep_hours_check";

-- Hand-added: db diff omits this, and Supabase default privileges would
-- otherwise leave anon/authenticated with ALL on the new table.
revoke all on table "public"."coffee_health_records" from "anon", "authenticated";

grant select on table "public"."coffee_health_records" to "anon";

grant select on table "public"."coffee_health_records" to "authenticated";

grant delete on table "public"."coffee_health_records" to "service_role";

grant insert on table "public"."coffee_health_records" to "service_role";

grant references on table "public"."coffee_health_records" to "service_role";

grant select on table "public"."coffee_health_records" to "service_role";

grant trigger on table "public"."coffee_health_records" to "service_role";

grant truncate on table "public"."coffee_health_records" to "service_role";

grant update on table "public"."coffee_health_records" to "service_role";


  create policy "Public read access"
  on "public"."coffee_health_records"
  as permissive
  for select
  to anon, authenticated
using (true);



