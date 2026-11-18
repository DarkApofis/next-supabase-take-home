"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Range } from "@/domain/coffee-records/query";

type Props = {
  id: string;
  label: string;
  value: Range;
  step: number;
  onChange: (range: Range) => void;
  debounceMs?: number;
};

const show = (n?: number) => (n === undefined ? "" : String(n));
const read = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));

/** Min/max inputs; typing is debounced so each keystroke doesn't trigger a query. */
export function RangeFilter({ id, label, value, step, onChange, debounceMs = 400 }: Props) {
  const [min, setMin] = useState(show(value.min));
  const [max, setMax] = useState(show(value.max));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow external URL changes (chip removed, back button) without remounting
  // the inputs, but ignore the echo of a value this input sent itself: the user
  // may already be typing past it.
  const [synced, setSynced] = useState(value);
  const [sent, setSent] = useState<Range | null>(null);
  if (synced.min !== value.min || synced.max !== value.max) {
    setSynced(value);
    const isEcho = sent !== null && sent.min === value.min && sent.max === value.max;
    if (!isEcho) {
      setMin(show(value.min));
      setMax(show(value.max));
    }
  }

  // Latest-callback: the timer outlives the render that created it, so it must
  // call the newest onChange (which closes over the newest sort/filters).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = (nextMin: string, nextMax: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const range = { min: read(nextMin), max: read(nextMax) };
      setSent(range);
      onChangeRef.current(range);
    }, debounceMs);
  };

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex items-center gap-2">
        <Label className="sr-only" htmlFor={`${id}-min`}>
          {label} minimum
        </Label>
        <Input
          id={`${id}-min`}
          type="number"
          inputMode="decimal"
          step={step}
          placeholder="Min"
          value={min}
          onChange={(e) => {
            setMin(e.target.value);
            schedule(e.target.value, max);
          }}
        />
        <span aria-hidden className="text-muted-foreground">
          –
        </span>
        <Label className="sr-only" htmlFor={`${id}-max`}>
          {label} maximum
        </Label>
        <Input
          id={`${id}-max`}
          type="number"
          inputMode="decimal"
          step={step}
          placeholder="Max"
          value={max}
          onChange={(e) => {
            setMax(e.target.value);
            schedule(min, e.target.value);
          }}
        />
      </div>
    </fieldset>
  );
}
