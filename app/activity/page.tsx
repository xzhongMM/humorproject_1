import Link from "next/link";
import { redirect } from "next/navigation";
import MemeCard, { type CaptionMeme } from "@/app/MemeCard";
import SignOutButton from "@/app/SignOutButton";
import { createClient } from "@/utils/supabase/server";

type ActivitySectionProps = {
  title: string;
  items: CaptionMeme[];
  userId: string;
  myVotes: Record<string, number>;
  error: string;
  voteError: string;
  emptyMessage: string;
  emptyLink: string;
  emptyLinkText: string;
};

function ActivitySection({
  title,
  items,
  userId,
  myVotes,
  error,
  voteError,
  emptyMessage,
  emptyLink,
  emptyLinkText,
}: ActivitySectionProps) {
  return (
    <section className="activity-section">
      <h2>{title}</h2>
      {error || (items.length > 0 && voteError) ? (
        <div className="status-panel error-panel" role="alert">
          <strong>Couldn't load this activity.</strong>
          <p>{error || voteError}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="status-panel">
          <strong>{emptyMessage}</strong>
          <p><Link href={emptyLink}>{emptyLinkText}</Link></p>
        </div>
      ) : (
        <div className="meme-grid">
          {items.map((item) => (
            <MemeCard key={item.id} item={item} userId={userId} myVote={myVotes[item.id] ?? 0} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memeFields = "id, content, upvotes, downvotes, created_at, memes(id, image_url, vibe, source, image_credit, image_source_url)";
  const [postsResult, likesResult] = await Promise.all([
    supabase
      .from("captions")
      .select(memeFields)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("caption_votes")
      .select(`caption_id, captions(${memeFields})`)
      .eq("user_id", user.id)
      .eq("vote", 1)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const posts = (postsResult.data as unknown as CaptionMeme[] | null) ?? [];
  const likedRows = (likesResult.data as unknown as { captions: CaptionMeme | null }[] | null) ?? [];
  const liked = likedRows.flatMap(({ captions }) => captions ? [captions] : []);
  const items = [...posts, ...liked];
  const myVotes: Record<string, number> = {};
  let voteError = "";

  if (items.length) {
    const { data: votes, error } = await supabase
      .from("caption_votes")
      .select("caption_id, vote")
      .eq("user_id", user.id)
      .in("caption_id", [...new Set(items.map((item) => item.id))]);
    voteError = error?.message ?? "";
    votes?.forEach((vote) => (myVotes[vote.caption_id] = vote.vote));
  }

  return (
    <main className="list-page feed-page">
      <nav className="page-nav feed-nav">
        <Link href="/">← Feed</Link>
        <Link href="/profile">Profile</Link>
        <SignOutButton />
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">Your Lion Laughs activity</p>
          <h1>My posts &amp; likes</h1>
        </div>
        <p className="row-count">Your memes and the captions you picked.</p>
      </header>

      <ActivitySection
        title="Your posts"
        items={posts}
        userId={user.id}
        myVotes={myVotes}
        error={postsResult.error?.message ?? ""}
        voteError={voteError}
        emptyMessage="You haven't made a meme yet."
        emptyLink="/create"
        emptyLinkText="Make your first meme."
      />
      <ActivitySection
        title="Posts you liked"
        items={liked}
        userId={user.id}
        myVotes={myVotes}
        error={likesResult.error?.message ?? ""}
        voteError={voteError}
        emptyMessage="You haven't liked a meme yet."
        emptyLink="/"
        emptyLinkText="Find one to vote for."
      />
    </main>
  );
}
