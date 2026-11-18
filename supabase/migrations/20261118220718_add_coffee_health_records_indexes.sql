CREATE INDEX coffee_health_records_age_id_idx ON public.coffee_health_records USING btree (age, id);

CREATE INDEX coffee_health_records_bmi_id_idx ON public.coffee_health_records USING btree (bmi, id);

CREATE INDEX coffee_health_records_caffeine_mg_id_idx ON public.coffee_health_records USING btree (caffeine_mg, id);

CREATE INDEX coffee_health_records_coffee_intake_id_idx ON public.coffee_health_records USING btree (coffee_intake, id);


CREATE INDEX coffee_health_records_heart_rate_id_idx ON public.coffee_health_records USING btree (heart_rate, id);

CREATE INDEX coffee_health_records_severe_idx ON public.coffee_health_records USING btree (id) WHERE (health_issues = 'Severe'::public.health_issue);

CREATE INDEX coffee_health_records_sleep_hours_id_idx ON public.coffee_health_records USING btree (sleep_hours, id);


