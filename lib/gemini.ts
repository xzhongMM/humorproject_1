// Shared Gemini helper used by the upload route and the daily bot.

// Tried in order. If a model is overloaded (503), rate-limited (429) or retired (404), we move on to the next one.
// Fallback list: the live list comes from llm_models (see loadModels in lib/config.ts).
export const MODELS = [
  ...new Set([process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"]),
];
const RETRYABLE = new Set([404, 429, 500, 503]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(apiKey: string, models: readonly string[], body: string, timeoutMs = 30000) {
  let last = { status: 0, detail: "" };
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        // Timed out or network error: try the next model instead of hanging.
        last = { status: 504, detail: e instanceof Error ? e.message : String(e) };
        console.error(`Gemini timeout/network error (${model})`, last.detail);
        break;
      }
      if (res.ok) return { ok: true as const, status: res.status, model, json: await res.json() };
      last = { status: res.status, detail: await res.text() };
      console.error(`Gemini error (${model}, attempt ${attempt + 1})`, last.status, last.detail);
      if (!RETRYABLE.has(res.status)) return { ok: false as const, model: "", json: null, ...last };
      if (res.status === 404) break; // retired model: don't retry, go to the next one
      await sleep(800 * (attempt + 1));
    }
  }
  return { ok: false as const, model: "", json: null, ...last };
}

// raw/usage/latencyMs are kept so the generation can be logged (see lib/generation-log.ts).
type CallInfo = { raw: unknown; inputTokens: number | null; outputTokens: number | null; latencyMs: number };
export type CaptionResult =
  | ({ ok: true; caption: string; model: string; status: number } & CallInfo)
  | ({ ok: false; caption: ""; model: string; status: number } & CallInfo);

/** Sends one image + prompt to Gemini and returns a single caption. */
export async function captionImage(
  apiKey: string,
  bytes: Buffer,
  mimeType: string,
  prompt: string,
  models: readonly string[] = MODELS,
): Promise<CaptionResult> {
  const started = Date.now();
  const gemini = await callGemini(
    apiKey,
    models,
    JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: bytes.toString("base64") } }, { text: prompt }] }],
      generationConfig: {
        temperature: 1.1,
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { caption: { type: "STRING" } }, required: ["caption"] },
      },
    }),
  );
  const info: CallInfo = {
    raw: gemini.json,
    inputTokens: gemini.json?.usageMetadata?.promptTokenCount ?? null,
    outputTokens: gemini.json?.usageMetadata?.candidatesTokenCount ?? null,
    latencyMs: Date.now() - started,
  };
  if (!gemini.ok) return { ok: false, caption: "", model: "", status: gemini.status, ...info };

  let caption = "";
  try {
    const text =
      gemini.json.candidates?.[0]?.content?.parts
        ?.filter((p: { thought?: boolean }) => !p.thought)
        .map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "{}";
    caption = String(JSON.parse(text)?.caption ?? "").trim().slice(0, 280);
  } catch {
    caption = "";
  }
  return caption
    ? { ok: true, caption, model: gemini.model, status: gemini.status, ...info }
    : { ok: false, caption: "", model: gemini.model, status: 502, ...info };
}
