/** Reserves the dashboard's layout while the first result set streams in (no layout shift). */
export function RecordsSkeleton() {
  return (
    <div role="status" aria-label="Loading records" className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="h-14 animate-pulse rounded-lg border bg-muted/40 motion-reduce:animate-none lg:h-[36rem]" />
      <div className="min-w-0 space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="overflow-hidden rounded-md border">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex gap-4 border-b px-3 py-3 last:border-0">
              {Array.from({ length: 8 }, (_, j) => (
                <div key={j} className="h-4 flex-1 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
