import { createAdminClient } from "@/lib/supabase-admin";
import type { CaptionResult } from "@/lib/gemini";

// Records every AI generation in the tables the admin area reads:
// generation_requests (one per attempt), llm_responses (what Gemini sent back) and images (the uploaded photo).
// Uses the service-role client because these tables have no RLS policies for normal users.
// Never throws: a logging failure must not stop someone from getting their meme.

// Must match prompt_chains.name (seeded by humor-project-2/sql/seed-admin-data.sql).
export const CHAINS = { upload: "User upload caption", bot: "Daily bot reaction caption" } as const;

type LogInput = {
  chain: (typeof CHAINS)[keyof typeof CHAINS];
  userId: string | null;
  prompt: string;
  ai: CaptionResult;
  memeId?: string | null;
  error?: string | null;
  image?: { path: string; url: string; caption: string } | null;
};

export async function logGeneration(input: LogInput) {
  try {
    const db = createAdminClient();
    const { ai } = input;

    // Link to the llm_models row (and its provider) if an admin has added one for this model.
    let modelId: string | null = null;
    let providerId: string | null = null;
    if (ai.model) {
      const { data: model } = await db
        .from("llm_models")
        .select("id, provider_id")
        .or(`identifier.eq.${ai.model},name.eq.${ai.model}`)
        .limit(1)
        .maybeSingle();
      modelId = model?.id ?? null;
      providerId = model?.provider_id ?? null;
    }

    const { data: chain } = await db.from("prompt_chains").select("id").eq("name", input.chain).limit(1).maybeSingle();

    const failed = !ai.ok || !!input.error;
    const { data: request, error: requestError } = await db
      .from("generation_requests")
      .insert({
        user_id: input.userId,
        meme_id: input.memeId ?? null,
        chain_id: chain?.id ?? null,
        provider_id: providerId,
        model_id: modelId,
        prompt: input.prompt,
        status: failed ? "failed" : "succeeded",
        error_message: input.error ?? (ai.ok ? null : `Gemini failed (${ai.status})`),
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (requestError) throw requestError;

    if (ai.raw) {
      const { error } = await db.from("llm_responses").insert({
        request_id: request.id,
        model_id: modelId,
        response_text: ai.caption || null,
        response_json: ai.raw,
        input_tokens: ai.inputTokens,
        output_tokens: ai.outputTokens,
        latency_ms: ai.latencyMs,
      });
      if (error) throw error;
    }

    if (input.image) {
      const { error } = await db.from("images").insert({
        user_id: input.userId,
        meme_id: input.memeId ?? null,
        storage_path: input.image.path,
        public_url: input.image.url,
        caption: input.image.caption,
      });
      if (error) throw error;
    }
  } catch (e) {
    console.error("Could not log generation:", (e as { message?: string })?.message ?? e);
  }
}
