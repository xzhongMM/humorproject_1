import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fetchColumbiaTopics } from "@/lib/reddit";
import { pickPhotos, downloadPhoto } from "@/lib/wikimedia";
import { buildBotPrompt } from "@/lib/vibes";
import { captionImage } from "@/lib/gemini";

// Daily bot: posts 5 memes a day, whether or not anyone logs in.
// Vercel Cron calls this once a day (see vercel.json) and sends `Authorization: Bearer $CRON_SECRET`.
// Test it by hand:  curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>/api/cron/daily-memes
// Make an extra batch even if today's 5 already exist:  .../api/cron/daily-memes?force=1

export const maxDuration = 300; // seconds (Vercel Hobby max). Normal runs take well under a minute.

const MEMES_PER_DAY = 5;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not set." }, { status: 500 });

  const db = createAdminClient();

  // Don't double-post if the job runs twice (retries, manual tests): top up to 5 per ~day.
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("memes").select("id", { count: "exact", head: true }).eq("source", "bot").gte("created_at", since);
  const force = new URL(request.url).searchParams.get("force") === "1"; // still requires the secret
  const needed = force ? MEMES_PER_DAY : MEMES_PER_DAY - (count ?? 0);
  if (needed <= 0) return NextResponse.json({ ok: true, created: 0, note: "Today's memes are already posted. Add ?force=1 to make another batch." });

  // Never reuse a photo.
  const { data: used } = await db.from("memes").select("image_source_url").not("image_source_url", "is", null);
  const usedUrls = new Set((used ?? []).map((r) => r.image_source_url as string));

  const [topics, photos] = await Promise.all([fetchColumbiaTopics(), pickPhotos(needed, usedUrls)]);

  const created: { caption: string; credit: string }[] = [];
  const errors: string[] = [];

  // Make all memes at the same time instead of one by one.
  await Promise.all(
    photos.map(async (photo) => {
      try {
        const bytes = await downloadPhoto(photo);
        const { vibe, prompt } = buildBotPrompt(topics, photo.kind);
        const ai = await captionImage(apiKey, bytes, photo.mime, prompt);
        if (!ai.ok) throw new Error(`Gemini failed (${ai.status})`);

        const ext = photo.mime === "image/png" ? "png" : "jpg";
        const path = `bot/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await db.storage.from("memes").upload(path, bytes, { contentType: photo.mime });
        if (uploadError) throw new Error(uploadError.message);
        const { data: { publicUrl } } = db.storage.from("memes").getPublicUrl(path);

        const { data: meme, error: memeError } = await db
          .from("memes")
          .insert({
            user_id: null,
            source: "bot",
            image_path: path,
            image_url: publicUrl,
            image_source_url: photo.sourceUrl,
            image_credit: photo.credit,
            vibe: vibe.label,
            prompt,
            model: ai.model,
          })
          .select("id")
          .single();
        if (memeError) throw new Error(memeError.message);

        const { error: captionError } = await db.from("captions").insert({ meme_id: meme.id, user_id: null, content: ai.caption });
        if (captionError) throw new Error(captionError.message);

        created.push({ caption: ai.caption, credit: photo.credit });
      } catch (e) {
        errors.push(`${photo.sourceUrl}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );

  if (errors.length) console.error("Daily meme bot errors:", errors);
  return NextResponse.json({ ok: errors.length === 0, created: created.length, topicsFound: topics.length, memes: created, errors });
}
