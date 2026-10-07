import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.first_name?.trim() || !profile?.last_name?.trim()) {
    redirect("/profile?complete=1");
  }

  // Profile is complete: send them to the meme feed.
  redirect("/");
}
