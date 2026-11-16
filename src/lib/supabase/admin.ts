import "server-only"; // Build fails if browser code ever imports this file.
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * DANGER: full-access Supabase connection that BYPASSES row-level security.
 * Only for trusted server-side jobs (e.g. background tasks, admin operations).
 * Never use it to handle a normal user's request — use ./server.ts instead.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const { SUPABASE_SECRET_KEY } = getServerEnv();
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
