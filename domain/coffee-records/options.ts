// Single source of truth for categorical values. Order matches the Postgres
// enum declarations (ordinal where the domain has an order).
export const GENDERS = ["Female", "Male", "Other"] as const;
export const COUNTRIES = [
  "Australia",
  "Belgium",
  "Brazil",
  "Canada",
  "China",
  "Finland",
  "France",
  "Germany",
  "India",
  "Italy",
  "Japan",
  "Mexico",
  "Netherlands",
  "Norway",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "UK",
  "USA",
] as const;
export const SLEEP_QUALITIES = ["Poor", "Fair", "Good", "Excellent"] as const;
export const STRESS_LEVELS = ["Low", "Medium", "High"] as const;
export const HEALTH_ISSUES = ["None", "Mild", "Moderate", "Severe"] as const;
export const OCCUPATIONS = [
  "Office",
  "Service",
  "Student",
  "Healthcare",
  "Other",
] as const;

// Each sortable column has a (col, id) btree index; keep this list in sync.
export const SORT_COLUMNS = [
  "id",
  "age",
  "coffee_intake",
  "caffeine_mg",
  "sleep_hours",
  "bmi",
  "heart_rate",
] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = "asc" | "desc";

export type Gender =(typeof GENDERS)[number];
export type Country = (typeof COUNTRIES)[number];
export type SleepQuality = (typeof SLEEP_QUALITIES)[number];
export type StressLevel = (typeof STRESS_LEVELS)[number];
export type HealthIssue = (typeof HEALTH_ISSUES)[number];
export type Occupation = (typeof OCCUPATIONS)[number];
