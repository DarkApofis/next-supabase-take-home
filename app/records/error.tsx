"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Button } from "@/components/ui/button";

export default function RecordsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // reset() alone re-renders the cached server payload; refresh refetches it.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <h1 className="text-xl font-semibold">Couldn&apos;t load the records</h1>
      <p className="text-sm text-muted-foreground">
        The database may be unavailable. Check that local Supabase is running, then try again.
        {error.digest && <span className="mt-2 block font-mono text-xs">Reference: {error.digest}</span>}
      </p>
      <Button onClick={retry}>Try again</Button>
    </main>
  );
}
