import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type ListQuery, SORT_COLUMNS, type SortColumn, withQueryChange } from "@/domain/coffee-records/query";
import type { CoffeeRecord } from "@/domain/coffee-records/record";
import { LABELS, recordsHref } from "@/lib/records";
import { cn } from "@/lib/utils";

type Column = keyof CoffeeRecord;

const COLUMNS: Column[] = [
  "id",
  "age",
  "gender",
  "country",
  "occupation",
  "coffee_intake",
  "caffeine_mg",
  "sleep_hours",
  "sleep_quality",
  "stress_level",
  "bmi",
  "heart_rate",
  "physical_activity_hours",
  "health_issues",
  "smoking",
  "alcohol_consumption",
];

const DECIMAL: ReadonlySet<Column> = new Set([
  "coffee_intake",
  "caffeine_mg",
  "sleep_hours",
  "bmi",
  "physical_activity_hours",
]);
const NUMERIC: ReadonlySet<Column> = new Set([...DECIMAL, "id", "age", "heart_rate"]);
const isSortable = (c: Column): c is SortColumn => (SORT_COLUMNS as readonly string[]).includes(c);

function format(column: Column, value: CoffeeRecord[Column]): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && DECIMAL.has(column)) return value.toFixed(1);
  return String(value);
}

function SortHeader({ column, query }: { column: SortColumn; query: ListQuery }) {
  const active = query.sort.column === column;
  const dir = active && query.sort.dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : query.sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link
      href={recordsHref(withQueryChange(query, { sort: { column, dir } }))}
      scroll={false}
      className="-mx-2 inline-flex min-h-10 items-center gap-1 rounded px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {LABELS[column]}
      <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      <span className="sr-only">, sort {dir === "asc" ? "ascending" : "descending"}</span>
    </Link>
  );
}

type Props = { rows: CoffeeRecord[]; query: ListQuery; summary: string };

export function DataTable({ rows, query, summary }: Props) {
  return (
    <Table
      containerClassName="max-h-[70vh] overflow-auto rounded-md border"
      className="text-sm"
    >
      <TableCaption className="sr-only">Coffee and health records. {summary}</TableCaption>
      <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((column) => {
            const sorted = query.sort.column === column;
            return (
              <TableHead
                key={column}
                scope="col"
                aria-sort={
                  isSortable(column)
                    ? sorted
                      ? query.sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined
                }
                className={cn(NUMERIC.has(column) && "text-right")}
              >
                {isSortable(column) ? <SortHeader column={column} query={query} /> : LABELS[column]}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {COLUMNS.map((column) =>
              column === "id" ? (
                <TableHead key={column} scope="row" className="text-right font-normal tabular-nums text-muted-foreground">
                  {row.id}
                </TableHead>
              ) : (
                <TableCell
                  key={column}
                  className={cn("whitespace-nowrap", NUMERIC.has(column) && "text-right tabular-nums")}
                >
                  {format(column, row[column])}
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
