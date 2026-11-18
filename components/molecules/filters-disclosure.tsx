"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

/** Collapsible on small screens, a plain always-open section from `lg` up; the panel is rendered once. */
export function FiltersDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="filters-heading" className="rounded-lg border bg-card p-4">
      <h2 id="filters-heading" className="font-medium">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="filters-body"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-10 w-full items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="flex-1">{label}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")}
            aria-hidden
          />
        </button>
        <span className="hidden min-h-10 items-center gap-2 lg:flex">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {label}
        </span>
      </h2>
      <div id="filters-body" className={cn("mt-2", open ? "block" : "hidden", "lg:block")}>
        {children}
      </div>
    </section>
  );
}
