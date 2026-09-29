import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import SignOutButton from "@/app/SignOutButton";

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

  return (
    <main className="page-shell">
      <section className="content-card">
        <nav className="page-nav"><Link href="/profile">Profile</Link><SignOutButton /></nav>
        <p className="eyebrow">Private area</p>
        <h1>Hello, {profile.first_name}.</h1>
        <p>You’re signed in as {user.email}. This dashboard is only available to authenticated users.</p>
      </section>
    </main>
  );
}
