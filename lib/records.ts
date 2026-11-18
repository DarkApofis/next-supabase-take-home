import {
  BOOLEAN_FILTERS,
  type Filters,
  type ListQuery,
  MULTI_FILTERS,
  type MultiFilterKey,
  parseListQuery,
  RANGE_FILTERS,
  toSearchParams,
} from "@/domain/coffee-records/query";

export const RECORDS_PATH = "/records";

export function recordsHref(q: ListQuery): string {
  const sp = toSearchParams(q).toString();
  return sp ? `${RECORDS_PATH}?${sp}` : RECORDS_PATH;
}

export const EMPTY_FILTERS = parseListQuery({}).filters;

export function activeFilterCount(f: Filters): number {
  let n = 0;
  for (const key of Object.keys(MULTI_FILTERS) as MultiFilterKey[]) n += f[key].length;
  for (const key of RANGE_FILTERS) if (f[key].min !== undefined || f[key].max !== undefined) n++;
  for (const key of BOOLEAN_FILTERS) if (f[key] !== undefined) n++;
  return n;
}

/** Human labels for columns and filters (UI copy lives here, not in the domain). */
export const LABELS = {
  id: "ID",
  age: "Age",
  gender: "Gender",
  country: "Country",
  coffee_intake: "Coffee (cups/day)",
  caffeine_mg: "Caffeine (mg)",
  sleep_hours: "Sleep (h)",
  sleep_quality: "Sleep quality",
  bmi: "BMI",
  heart_rate: "Heart rate (bpm)",
  stress_level: "Stress",
  physical_activity_hours: "Activity (h/wk)",
  health_issues: "Health issues",
  occupation: "Occupation",
  smoking: "Smoker",
  alcohol_consumption: "Drinks alcohol",
} as const;
