import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildPrompt } from "@/lib/vibes";
import { captionImage } from "@/lib/gemini";

const DAILY_LIMIT = 10; // per user; keeps everyone inside Gemini's free tier
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to make memes." }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not set on the server." }, { status: 500 });

  const form = await request.formData();
  const file = form.get("image");
  const vibeId = String(form.get("vibe") ?? "");
  if (!(file instanceof File) || !ALLOWED_TYPES.includes(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Upload a JPEG, PNG, or WebP image under 5 MB." }, { status: 400 });
  }

  // Simple per-user daily limit.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("memes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `You've hit today's limit of ${DAILY_LIMIT} memes. Go vote on some instead!` }, { status: 429 });
  }

  // 1. Ask Gemini for captions.
  const bytes = Buffer.from(await file.arrayBuffer());
  const { vibe, prompt } = buildPrompt(vibeId);
  const gemini = await captionImage(apiKey, bytes, file.type, prompt);
  if (!gemini.ok) {
    const busy = gemini.status === 503 || gemini.status === 429;
    return NextResponse.json(
      {
        error: busy
          ? "Gemini is overloaded right now. Wait a minute and try again."
          : gemini.model
            ? "The AI didn't return a caption for that photo. Try again."
            : `The AI request failed (${gemini.status}).`,
      },
      { status: 502 },
    );
  }
  const caption = gemini.caption;

  // 2. Store the photo in Supabase Storage (path starts with the user's id, required by the storage policy).
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("memes").upload(path, bytes, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data: { publicUrl } } = supabase.storage.from("memes").getPublicUrl(path);

  // 3. Save the meme (photo + the prompt used) and its one caption. RLS checks these as the signed-in user.
  const { data: meme, error: memeError } = await supabase
    .from("memes")
    .insert({ user_id: user.id, image_path: path, image_url: publicUrl, vibe: vibe.label, prompt, model: gemini.model })
    .select("id")
    .single();
  if (memeError) return NextResponse.json({ error: memeError.message }, { status: 500 });

  const { data: saved, error: captionError } = await supabase
    .from("captions")
    .insert({ meme_id: meme.id, user_id: user.id, content: caption })
    .select("id")
    .single();
  if (captionError) return NextResponse.json({ error: captionError.message }, { status: 500 });

  return NextResponse.json({ id: saved.id, caption });
}
