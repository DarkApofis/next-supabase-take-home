import type { ReactNode } from "react";
import { FiltersDisclosure } from "@/components/molecules/filters-disclosure";

type Props = {
  filters: ReactNode;
  activeFilterCount: number;
  summary: ReactNode;
  chips: ReactNode;
  children: ReactNode;
};

/** Filters in a sticky sidebar on large screens, a collapsible section above the table on small ones. */
export function DashboardTemplate({ filters, activeFilterCount, summary, chips, children }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <FiltersDisclosure label={activeFilterCount ? `Filters (${activeFilterCount})` : "Filters"}>
          {filters}
        </FiltersDisclosure>
      </aside>
      <section aria-label="Results" className="min-w-0 space-y-4">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {summary}
          </p>
          {chips}
        </div>
        {children}
      </section>
    </div>
  );
}
