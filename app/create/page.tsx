import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CreateForm from "./CreateForm";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="page-shell">
      <section className="content-card">
        <nav className="page-nav"><Link href="/">← Back to the feed</Link></nav>
        <p className="eyebrow">Make a meme</p>
        <h1>Drop a pic.</h1>
        <p>Upload a photo, pick a vibe, and AI writes a caption. Not feeling it? Make another — every version gets voted on separately.</p>
        <CreateForm />
      </section>
    </main>
  );
}
