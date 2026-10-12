import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCaptionMeme } from "@/lib/memes";
import MemeCard from "@/app/MemeCard";

type Props = { params: Promise<{ id: string }> };

// Link previews (iMessage, WeChat, WhatsApp, Slack, etc.) use this title/description,
// plus the picture from ./opengraph-image.tsx.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getCaptionMeme(id);
  if (!item) return { title: "Meme not found · Lion Laughs" };
  return {
    title: `${item.content} · Lion Laughs`,
    description: "A Columbia meme on Lion Laughs. Vote on whether it hits.",
    openGraph: { title: item.content, description: "Vote on it at Lion Laughs", type: "article" },
    twitter: { card: "summary_large_image", title: item.content },
  };
}

// The page a shared link opens: just this one meme, with voting, plus a way into the feed.
export default async function SharedMemePage({ params }: Props) {
  const { id } = await params;
  const item = await getCaptionMeme(id);
  if (!item) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let myVote = 0;
  if (user) {
    const { data } = await supabase.from("caption_votes").select("vote").eq("caption_id", id).eq("user_id", user.id).maybeSingle();
    myVote = data?.vote ?? 0;
  }

  return (
    <main className="list-page feed-page single-meme-page">
      <nav className="page-nav feed-nav">
        <Link href="/">← All memes</Link>
        {!user && <Link className="home-signin" href="/login">Sign in to vote</Link>}
      </nav>
      <p className="eyebrow">Lion Laughs · Columbia meme board</p>
      <div className="single-meme">
        <MemeCard item={item} userId={user?.id ?? null} myVote={myVote} />
      </div>
      <p className="single-meme-more">
        <Link className="home-signin" href="/">See more memes</Link>
      </p>
    </main>
  );
}
