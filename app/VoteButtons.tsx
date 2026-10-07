"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Props = {
  captionId: string;
  userId: string | null;
  initialVote: number; // 1, -1, or 0 (no vote yet)
  initialUp: number;
  initialDown: number;
};

export default function VoteButtons({ captionId, userId, initialVote, initialUp, initialDown }: Props) {
  const [vote, setVote] = useState(initialVote);
  const [up, setUp] = useState(initialUp);
  const [down, setDown] = useState(initialDown);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // When the server sends fresh numbers (refresh, tab switch), use them instead of old local state.
  useEffect(() => {
    setVote(initialVote);
    setUp(initialUp);
    setDown(initialDown);
  }, [captionId, initialVote, initialUp, initialDown]);

  if (!userId) {
    return (
      <div className="vote-box">
        <Link className="vote-btn" href="/login" title="Sign in to vote">▲</Link>
        <span className="vote-score">{initialUp - initialDown}</span>
        <Link className="vote-btn" href="/login" title="Sign in to vote">▼</Link>
      </div>
    );
  }

  async function cast(value: 1 | -1) {
    if (busy) return;
    const prev = { vote, up, down };
    const next = vote === value ? 0 : value;
    // Optimistic update so the click feels instant...
    setVote(next);
    setUp(up - (vote === 1 ? 1 : 0) + (next === 1 ? 1 : 0));
    setDown(down - (vote === -1 ? 1 : 0) + (next === -1 ? 1 : 0));
    setBusy(true);
    setError("");

    // ...then the database decides (insert / switch / remove) and returns the real totals.
    const { data, error } = await createClient()
      .rpc("cast_vote", { p_caption_id: captionId, p_vote: value })
      .single<{ up_count: number; down_count: number; my_vote: number }>();

    if (error || !data) {
      setVote(prev.vote);
      setUp(prev.up);
      setDown(prev.down);
      setError("Vote didn't save");
    } else {
      setVote(data.my_vote);
      setUp(data.up_count);
      setDown(data.down_count);
    }
    setBusy(false);
  }

  return (
    <div className="vote-box">
      <button className={vote === 1 ? "vote-btn up active" : "vote-btn up"} onClick={() => cast(1)} disabled={busy} aria-pressed={vote === 1} aria-label="Upvote">▲</button>
      <span className="vote-score" title={`${up} up · ${down} down`}>{up - down}</span>
      <button className={vote === -1 ? "vote-btn down active" : "vote-btn down"} onClick={() => cast(-1)} disabled={busy} aria-pressed={vote === -1} aria-label="Downvote">▼</button>
      {error && <span className="form-error vote-error">{error}</span>}
    </div>
  );
}
