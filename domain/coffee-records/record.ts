import { z } from "zod";
import {
  COUNTRIES,
  GENDERS,
  HEALTH_ISSUES,
  OCCUPATIONS,
  SLEEP_QUALITIES,
  STRESS_LEVELS,
} from "./options.ts";

// Bounds mirror the column types (numeric precision) and CHECK constraints in
// supabase/schemas/coffee_health_records.sql.
export const coffeeRecordSchema = z.object({
  id: z.number().int().positive().max(2_147_483_647), // Postgres integer
  age: z.number().int().min(0).max(130),
  gender: z.enum(GENDERS),
  country: z.enum(COUNTRIES),
  coffee_intake: z.number().min(0).max(99.9),
  caffeine_mg: z.number().min(0).max(999.9),
  sleep_hours: z.number().min(0).max(24),
  sleep_quality: z.enum(SLEEP_QUALITIES),
  bmi: z.number().positive().max(999.9),
  heart_rate: z.number().int().min(20).max(250),
  stress_level: z.enum(STRESS_LEVELS),
  physical_activity_hours: z.number().min(0).max(999.9),
  health_issues: z.enum(HEALTH_ISSUES),
  occupation: z.enum(OCCUPATIONS),
  smoking: z.boolean(),
  alcohol_consumption: z.boolean(),
});

export type CoffeeRecord = z.infer<typeof coffeeRecordSchema>;
