import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProfileForm from "./ProfileForm";
import SignOutButton from "@/app/SignOutButton";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ complete?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const params = await searchParams;

  return (
    <main className="page-shell">
      <section className="content-card">
        <nav className="page-nav"><Link href="/">Meme feed</Link><SignOutButton /></nav>
        <p className="eyebrow">Your account</p>
        <h1>Profile</h1>
        <p className="muted">Signed in as {user.email}</p>
        {params.complete && <p className="notice">Add your first and last name to start voting on memes.</p>}
        <ProfileForm userId={user.id} firstName={profile?.first_name ?? ""} lastName={profile?.last_name ?? ""} avatarUrl={profile?.avatar_url ?? ""} />
      </section>
    </main>
  );
}
