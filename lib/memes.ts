import { createClient } from "@supabase/supabase-js";
import type { CaptionMeme } from "@/app/MemeCard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Loads one meme (a caption + its photo) for the share page and its link-preview image.
// Uses the public anon key: memes and captions are readable by everyone under RLS.
export async function getCaptionMeme(id: string): Promise<CaptionMeme | null> {
  if (!UUID.test(id)) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from("captions")
    .select("id, content, upvotes, downvotes, created_at, memes(id, image_url, vibe, source, image_credit, image_source_url)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as CaptionMeme) ?? null;
}
