"use client";

import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
};

/** Any / Yes / No as a native select: keyboard and screen-reader support for free. */
export function BooleanFilter({ id, label, value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
      </Label>
      <select
        id={id}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "true")}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}
