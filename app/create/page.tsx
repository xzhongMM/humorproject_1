import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CreateForm from "./CreateForm";
import { isAdmin } from "@/lib/admin";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Admin-only. Everyone else (signed in or not) sees a normal 404, as if the page doesn't exist.
  if (!user || !(await isAdmin(supabase))) notFound();

  return (
    <main className="page-shell">
      <section className="content-card">
        <nav className="page-nav"><Link href="/">← Back to the feed</Link></nav>
        <p className="eyebrow">Admin · Make a meme</p>
        <h1>Drop a pic.</h1>
        <p>Upload a photo, pick a vibe, and AI writes a caption. Not feeling it? Make another — every version gets voted on separately.</p>
        <CreateForm />
      </section>
    </main>
  );
}
