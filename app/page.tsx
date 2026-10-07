import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import SignOutButton from "@/app/SignOutButton";
import MemeCard, { type CaptionMeme } from "./MemeCard";
import { isAdmin } from "@/lib/admin";

type Sort = "liked" | "today" | "new";
const TABS: { id: Sort; label: string }[] = [
  { id: "liked", label: "Most liked" },
  { id: "today", label: "Top today" },
  { id: "new", label: "Fresh" },
];

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort: rawSort } = await searchParams;
  // Default feed = most-liked memes first.
  const sort: Sort = rawSort === "today" || rawSort === "new" ? rawSort : "liked";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const admin = user ? await isAdmin(supabase) : false;

  // Every caption is its own meme card (photo + that one caption), voted on separately.
  let query = supabase
    .from("captions")
    .select("id, content, upvotes, downvotes, created_at, memes(id, image_url, vibe)")
    .limit(30);
  if (sort === "new") {
    query = query.order("created_at", { ascending: false });
  } else {
    // Most upvotes first; ties go to the one with the better score, then the newest.
    query = query
      .order("upvotes", { ascending: false })
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });
    if (sort === "today") query = query.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }
  const { data, error } = await query;
  const items = (data as unknown as CaptionMeme[]) ?? [];
  const loadError = error?.message ?? "";

  // Which of these captions has the signed-in user already voted on?
  const myVotes: Record<string, number> = {};
  if (userId && items.length) {
    const { data: votes } = await supabase
      .from("caption_votes")
      .select("caption_id, vote")
      .eq("user_id", userId) // only MY votes (don't rely on RLS alone for this)
      .in("caption_id", items.map((c) => c.id));
    votes?.forEach((v) => (myVotes[v.caption_id] = v.vote));
  }

  return (
    <main className="list-page feed-page">
      <nav className="page-nav feed-nav">
        {user ? (
          <>
            {admin && <Link className="home-signin" href="/create">+ Make a meme</Link>}
            <Link href="/profile">Profile</Link>
            <SignOutButton />
          </>
        ) : (
          <Link className="home-signin" href="/login">Sign in to vote</Link>
        )}
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">Columbia meme board</p>
          <h1>Lion Laughs</h1>
        </div>
        <p className="row-count">AI writes the captions. You pick the winner.</p>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <Link key={t.id} href={`/?sort=${t.id}`} role="tab" aria-selected={sort === t.id} className={sort === t.id ? "tab active" : "tab"}>
            {t.label}
          </Link>
        ))}
      </div>

      {loadError && (
        <div className="status-panel error-panel"><strong>Couldn't load memes.</strong><p>{loadError}</p></div>
      )}

      {!loadError && items.length === 0 && (
        <div className="status-panel">
          <strong>{sort === "today" ? "No captions in the last 24 hours yet." : "No memes yet."}</strong>
          <p>{admin ? <Link href="/create">Be the first — upload a photo.</Link> : "New memes drop soon. Check back!"}</p>
        </div>
      )}

      <div className="meme-grid">
        {items.map((item, i) => (
          <MemeCard key={item.id} item={item} userId={userId} myVote={myVotes[item.id] ?? 0} rank={sort === "new" ? undefined : i + 1} />
        ))}
      </div>
    </main>
  );
}
