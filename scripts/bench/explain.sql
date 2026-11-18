-- The SQL shapes the repository sends through PostgREST, run as the anon role
-- (so RLS is in the plan). Run via scripts/bench/run.sh.
set role anon;
\timing off

\echo '== Q1 default page 1: order by id'
explain (analyze, buffers, costs off, summary on)
select * from public.coffee_health_records order by id limit 26;

\echo '== Q2 sort caffeine_mg desc, page 1'
explain (analyze, buffers, costs off, summary on)
select * from public.coffee_health_records order by caffeine_mg desc, id desc limit 26;

\echo '== Q3 keyset deep: sort age asc, cursor (60, 500000)'
explain (analyze, buffers, costs off, summary on)
select * from public.coffee_health_records
where age >= 60 and (age > 60 or (age = 60 and id > 500000))
order by age, id limit 26;

\echo '== Q4 offset deep: sort age asc, page 20000'
explain (analyze, buffers, costs off, summary on)
select * from public.coffee_health_records order by age, id offset 499975 limit 26;

\echo '== Q5 filter + sort: country in (Spain, France), age 20-40, sort age'
explain (analyze, buffers, costs off, summary on)
select * from public.coffee_health_records
where country in ('Spain', 'France') and age >= 20 and age <= 40
order by age, id limit 26;

\echo '== Q6 rare category: health_issues = Severe, sort id'
explain (analyze, buffers, costs off, summary on)
select * from public.coffee_health_records where health_issues = any ('{Severe}') order by id limit 26;

\echo '== Q7 capped count (PostgREST estimated mode) for 3 filters'
explain (analyze, buffers, costs off, summary on)
select count(*) from (
  select 1 from public.coffee_health_records
  where gender = 'Female' and smoking = false and country = 'Spain' limit 1001
) s;

\echo '== Q8 selective capped count: Severe + Japan'
explain (analyze, buffers, costs off, summary on)
select count(*) from (
  select 1 from public.coffee_health_records
  where health_issues = any ('{Severe}') and country = any ('{Japan}') limit 1001
) s;

\echo '== Q9 planner estimate for correlated filters (sleep_quality Poor + stress High)'
explain select * from public.coffee_health_records
where sleep_quality = 'Poor' and stress_level = 'High';

\echo '== Q10 selective capped count without a usable index (Moderate+Severe, Japan)'
explain (analyze, buffers, costs off, summary on)
select count(*) from (
  select 1 from public.coffee_health_records
  where health_issues = any ('{Moderate,Severe}') and country = any ('{Japan}') limit 1001
) s;

\echo '== Q11 keyset as a true row comparison (what an RPC could send; PostgREST cannot)'
explain (analyze, buffers, costs off, summary on)
select * from public.coffee_health_records where (age, id) > (60, 500000) order by age, id limit 26;

reset role;
