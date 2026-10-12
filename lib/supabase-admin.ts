import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY Supabase client that uses the service-role (secret) key and bypasses RLS.
// Only the daily bot uses it, because nobody is logged in when the cron job runs.
// Never import this from a "use client" file, and never give the key a NEXT_PUBLIC_ prefix.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY (server-only) to run the daily bot.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
