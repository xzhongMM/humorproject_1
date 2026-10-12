import VoteButtons from "./VoteButtons";

// One card = one photo + ONE caption. Every caption is its own meme and is voted on separately.
export type CaptionMeme = {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  memes: { id: string; image_url: string; vibe: string; source?: string; image_credit?: string | null; image_source_url?: string | null } | null;
};

export default function MemeCard({ item, userId, myVote, rank }: { item: CaptionMeme; userId: string | null; myVote: number; rank?: number }) {
  return (
    <article className="meme-card" id={`caption-${item.id}`}>
      <p className="meme-text">{item.content}</p>
      <div className="meme-frame">
        {rank !== undefined && <span className="rank-badge">#{rank}</span>}
        {item.memes && <img src={item.memes.image_url} alt="Meme photo" loading="lazy" />}
      </div>
      {item.memes?.image_credit && (
        <p className="photo-credit">
          Photo:{" "}
          {item.memes.image_source_url ? (
            <a href={item.memes.image_source_url} target="_blank" rel="noopener noreferrer">{item.memes.image_credit}</a>
          ) : (
            item.memes.image_credit
          )}
        </p>
      )}
      <div className="meme-footer">
        <div className="meme-meta">
          {item.memes?.source === "bot" && <span className="vibe-tag daily-tag">Daily drop</span>}
          {item.memes && <span className="vibe-tag">{item.memes.vibe}</span>}
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
        </div>
        <VoteButtons captionId={item.id} userId={userId} initialVote={myVote} initialUp={item.upvotes} initialDown={item.downvotes} />
      </div>
    </article>
  );
}
