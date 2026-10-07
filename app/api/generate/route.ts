import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildPrompt } from "@/lib/vibes";
import { isAdmin } from "@/lib/admin";

// Tried in order. If a model is overloaded (503), rate-limited (429) or retired (404), we move on to the next one.
const MODELS = [
  ...new Set([process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"]),
];
const RETRYABLE = new Set([404, 429, 500, 503]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(apiKey: string, body: string) {
  let last = { status: 0, detail: "" };
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
      });
      if (res.ok) return { ok: true as const, status: res.status, model, json: await res.json() };
      last = { status: res.status, detail: await res.text() };
      console.error(`Gemini error (${model}, attempt ${attempt + 1})`, last.status, last.detail);
      if (!RETRYABLE.has(res.status)) return { ok: false as const, ...last };
      if (res.status === 404) break; // retired model: don't retry, go to the next one
      await sleep(800 * (attempt + 1));
    }
  }
  return { ok: false as const, ...last };
}
const DAILY_LIMIT = 50; // admin safety cap; keeps usage inside Gemini's free tier
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Only admins can create memes. Everyone else gets a plain 404 so the endpoint stays hidden.
  if (!user || !(await isAdmin(supabase))) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  const gemini = await callGemini(
    apiKey,
    JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: file.type, data: bytes.toString("base64") } }, { text: prompt }] }],
      generationConfig: {
        temperature: 1.1,
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { caption: { type: "STRING" } }, required: ["caption"] },
      },
    }),
  );
  if (!gemini.ok) {
    const busy = gemini.status === 503 || gemini.status === 429;
    return NextResponse.json(
      { error: busy ? "Gemini is overloaded right now. Wait a minute and try again." : `The AI request failed (${gemini.status}).` },
      { status: 502 },
    );
  }
  const geminiJson = gemini.json;
  let caption = "";
  try {
    const text = geminiJson.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("") ?? "{}";
    const parsed = JSON.parse(text);
    caption = String(parsed?.caption ?? "").trim().slice(0, 280);
  } catch {
    caption = "";
  }
  if (!caption) {
    return NextResponse.json({ error: "The AI didn't return a caption for that photo. Try again." }, { status: 502 });
  }

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
