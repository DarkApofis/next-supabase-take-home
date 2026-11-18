import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Anon client without cookies: the dataset is public and read-only under RLS,
 * and a cookie-free client can be used inside cached functions.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
