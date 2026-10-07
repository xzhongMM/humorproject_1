import type { SupabaseClient } from "@supabase/supabase-js";

// Asks the database (public.is_admin()) whether the signed-in user is an admin.
// The database also enforces this with RLS, so this check is for hiding UI and giving clear errors.
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}
