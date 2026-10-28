import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CHAINS } from "@/lib/generation-log";
import { loadVibes } from "@/lib/config";
import CreateForm from "./CreateForm";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Vibes are admin-editable (terms + prompt_chain_mix); only id/label go to the browser.
  const vibes = (await loadVibes(CHAINS.upload)).map(({ id, label }) => ({ id, label }));

  return (
    <main className="page-shell">
      <section className="content-card">
        <nav className="page-nav"><Link href="/">← Back to the feed</Link></nav>
        <p className="eyebrow">Make a meme</p>
        <h1>Drop a pic.</h1>
        <p>Upload a photo, pick a vibe, and AI writes a caption. Not feeling it? Make another — every version gets voted on separately.</p>
        <CreateForm vibes={vibes} />
      </section>
    </main>
  );
}
