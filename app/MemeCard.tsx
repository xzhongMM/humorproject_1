import VoteButtons from "./VoteButtons";

// One card = one photo + ONE caption. Every caption is its own meme and is voted on separately.
export type CaptionMeme = {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  memes: { id: string; image_url: string; vibe: string } | null;
};

export default function MemeCard({ item, userId, myVote, rank }: { item: CaptionMeme; userId: string | null; myVote: number; rank?: number }) {
  return (
    <article className="meme-card" id={`caption-${item.id}`}>
      <p className="meme-text">{item.content}</p>
      <div className="meme-frame">
        {rank !== undefined && <span className="rank-badge">#{rank}</span>}
        {item.memes && <img src={item.memes.image_url} alt="Meme photo" loading="lazy" />}
      </div>
      <div className="meme-footer">
        <div className="meme-meta">
          {item.memes && <span className="vibe-tag">{item.memes.vibe}</span>}
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
        </div>
        <VoteButtons captionId={item.id} userId={userId} initialVote={myVote} initialUp={item.upvotes} initialDown={item.downvotes} />
      </div>
    </article>
  );
}
