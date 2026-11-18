"use client";

import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props<T extends string> = {
  id: string;
  label: string;
  options: readonly T[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
};

/** Checkbox menu; stays open while toggling so several values can be picked in one go. */
export function MultiSelectFilter<T extends string>({ id, label, options, selected, onChange }: Props<T>) {
  const summary =
    selected.length === 0 ? "Any" : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  const toggle = (option: T, checked: boolean) =>
    onChange(checked ? options.filter((o) => o === option || selected.includes(o)) : selected.filter((o) => o !== option));

  return (
    <div className="space-y-1.5">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
            aria-labelledby={`${id}-label ${id}-value`}
          >
            <span id={`${id}-value`} className="truncate">
              {summary}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-72 w-[--radix-dropdown-menu-trigger-width] overflow-y-auto">
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.includes(option)}
              onCheckedChange={(checked) => toggle(option, checked === true)}
              onSelect={(e) => e.preventDefault()}
            >
              {option}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
