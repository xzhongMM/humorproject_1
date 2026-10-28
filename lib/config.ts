import { createAdminClient } from "@/lib/supabase-admin";
import { VIBES, buildPrompt, buildBotPrompt } from "@/lib/vibes";
import { MODELS } from "@/lib/gemini";
import { CHAINS } from "@/lib/generation-log";

// SERVER-ONLY. Reads the site's configuration from the tables admins edit in humor-project-2
// (terms, prompt chains, examples, models, signup rules), so changes there apply without a redeploy.
// Every loader falls back to the hardcoded values in lib/vibes.ts / lib/gemini.ts if the database
// errors or has no usable rows, so the site never breaks because of config.
// Never import this from a "use client" file: it uses the service-role key.

type Chain = (typeof CHAINS)[keyof typeof CHAINS];
type Db = ReturnType<typeof createAdminClient>;
export type Vibe = { id: string; label: string; hint: string; weight: number };
export type PhotoKind = "animal" | "person" | "emoji";

const MAX_PROMPT_CHARS = 4000;
const JSON_ASK = 'Return JSON: {"caption": "..."}.';
const NO_TOPICS = "Build the situation from everyday Columbia student life.";
const FALLBACK_VIBES: Vibe[] = VIBES.map((v) => ({ ...v, weight: 1 }));

// Runs a loader; returns `fallback` if it throws or returns null (= no usable rows).
async function orFallback<T>(what: string, load: () => Promise<T | null>, fallback: T): Promise<T> {
  try {
    const value = await load();
    if (value !== null) return value;
  } catch (e) {
    console.error(`Config: could not load ${what}, using defaults:`, (e as { message?: string })?.message ?? e);
  }
  return fallback;
}

// Short in-memory cache (only used for the signup check, which runs on every request in proxy.ts).
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function must<T>({ data, error }: { data: T | null; error: unknown }) {
  if (error) throw error;
  return data;
}

async function findChain(db: Db, chain: Chain) {
  return must(
    await db.from("prompt_chains").select("id, active").eq("name", chain).limit(1).maybeSingle<{ id: string; active: boolean }>(),
  );
}

/* ---------- Vibes (terms + prompt_chain_mix) ---------- */

/** Active terms that the chain's mix uses with weight > 0, in the same order as VIBES. */
export async function loadVibes(chain: Chain): Promise<Vibe[]> {
  return orFallback(
    "vibes",
    async () => {
      const db = createAdminClient();
      const found = await findChain(db, chain);
      if (!found) return null;
      const mix = must(await db.from("prompt_chain_mix").select("term_id, weight").eq("chain_id", found.id).gt("weight", 0)) ?? [];
      if (!mix.length) return null;
      const terms =
        must(
          await db
            .from("terms")
            .select("id, name, slug, description")
            .eq("active", true)
            .in("id", mix.map((m) => m.term_id)),
        ) ?? [];
      const weight = new Map(mix.map((m) => [m.term_id as string, Number(m.weight)]));
      const rank = (slug: string) => {
        const i = VIBES.findIndex((v) => v.id === slug);
        return i === -1 ? VIBES.length : i;
      };
      const vibes = terms
        .filter((t) => t.slug && t.name)
        .map((t) => ({ id: t.slug as string, label: t.name as string, hint: (t.description as string) ?? "", weight: weight.get(t.id) ?? 0 }))
        .sort((a, b) => rank(a.id) - rank(b.id) || a.label.localeCompare(b.label));
      return vibes.length ? vibes : null;
    },
    FALLBACK_VIBES,
  );
}

/** Random vibe, weighted by prompt_chain_mix.weight. */
export function pickWeighted(vibes: Vibe[]): Vibe {
  const total = vibes.reduce((sum, v) => sum + v.weight, 0);
  let r = Math.random() * total;
  for (const v of vibes) {
    r -= v.weight;
    if (r < 0) return v;
  }
  return vibes[vibes.length - 1];
}

/* ---------- Prompts (prompt_chain_steps + generation_examples) ---------- */

type PromptData = { vibe: Vibe; kind?: PhotoKind; topics?: string[] };

// Fills the placeholders of one step. Returns null when the step needs data we don't have.
function fillStep(instruction: string, data: PromptData, topics: string[]) {
  let missing = false;
  const text = instruction
    .replaceAll("{vibe.label}", data.vibe.label)
    .replaceAll("{vibe.hint}", data.vibe.hint)
    .replace(/\{an animal \| a person \| an emoji\}/g, () => {
      if (!data.kind) missing = true;
      return { animal: "an animal", person: "a person", emoji: "an emoji" }[data.kind ?? "animal"];
    })
    .replace(/\{up to 5 topics\}/g, () => {
      if (!topics.length) missing = true;
      return topics.map((t) => `"${t}"`).join("; ");
    });
  return { text: text.trim(), missing, hasTopics: instruction.includes("{up to 5 topics}") };
}

/**
 * Builds the caption prompt for a chain from its steps (ordered by position) plus up to 3 examples.
 * Falls back to buildPrompt/buildBotPrompt if the chain is missing, inactive or has no steps.
 */
export async function loadPrompt(chain: Chain, data: PromptData): Promise<string> {
  const isBot = chain === CHAINS.bot;
  const sep = isBot ? "\n" : " ";
  const fallback = () =>
    isBot ? buildBotPrompt(data.topics ?? [], data.kind, data.vibe).prompt : buildPrompt(data.vibe.id, data.vibe).prompt;

  const prompt = await orFallback(
    "prompt",
    async () => {
      const db = createAdminClient();
      const found = await findChain(db, chain);
      if (!found?.active) return null;
      const [steps, examples] = await Promise.all([
        db.from("prompt_chain_steps").select("instruction, required").eq("chain_id", found.id).order("position"),
        db
          .from("generation_examples")
          .select("expected_output")
          .eq("chain_id", found.id)
          .eq("active", true)
          .order("created_at")
          .limit(10),
      ]);

      const topics = [...(data.topics ?? [])].sort(() => Math.random() - 0.5).slice(0, 5);
      const parts: string[] = [];
      for (const step of must(steps) ?? []) {
        if (!step.instruction?.trim()) continue;
        const { text, missing, hasTopics } = fillStep(step.instruction, data, topics);
        if (!missing || step.required) parts.push(text);
        else if (hasTopics) parts.push(NO_TOPICS);
      }
      if (!parts.length) return null;
      if (!parts.join(" ").includes('"caption"')) parts.push(JSON_ASK); // lib/gemini.ts parses this JSON

      let prompt = parts.join(sep);
      // Examples are optional: a failed query just means none are added.
      const outputs = (examples.error ? [] : examples.data ?? []).map((e) => String(e.expected_output ?? "").trim()).filter(Boolean);
      for (const output of outputs.slice(0, 3)) {
        const next = `${prompt}${sep}Example caption: ${output}`;
        if (next.length > MAX_PROMPT_CHARS) break;
        prompt = next;
      }
      return prompt;
    },
    null,
  );
  return prompt ?? fallback();
}

/* ---------- Models (llm_models + llm_providers) ---------- */

/**
 * Gemini model ids to try, in order: GEMINI_MODEL, then the fallback order, then other active models.
 * Returns [] when Google models are configured but all deactivated (the caller should refuse to generate).
 */
export async function loadModels(): Promise<string[]> {
  return orFallback(
    "models",
    async () => {
      const db = createAdminClient();
      const [providers, models] = await Promise.all([
        db.from("llm_providers").select("id, active").eq("name", "Google"),
        db.from("llm_models").select("identifier, active, provider_id").order("created_at"),
      ]);
      const google = must(providers) ?? [];
      const ids = new Set(google.map((p) => p.id));
      const live = new Set(google.filter((p) => p.active).map((p) => p.id));
      const rows = (must(models) ?? []).filter((m) => ids.has(m.provider_id) && m.identifier);
      if (!rows.length) return null; // nothing configured yet
      const active = rows.filter((m) => m.active && live.has(m.provider_id)).map((m) => m.identifier as string);
      return [...new Set([...MODELS.filter((id) => active.includes(id)), ...active])];
    },
    [...MODELS],
  );
}

/* ---------- Signup restrictions (allowed_signup_domains + whitelisted_emails) ---------- */

type SignupRules = { domains: string[]; emails: string[] };

async function loadSignupRules(): Promise<SignupRules> {
  return cached("signup", 60_000, () =>
    orFallback(
      "signup rules",
      async () => {
        const db = createAdminClient();
        const [domains, emails] = await Promise.all([
          db.from("allowed_signup_domains").select("domain").eq("active", true),
          db.from("whitelisted_emails").select("email").eq("active", true),
        ]);
        const clean = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/^@/, "");
        return {
          domains: (must(domains) ?? []).map((d) => clean(d.domain)).filter(Boolean),
          emails: (must(emails) ?? []).map((e) => clean(e.email)).filter(Boolean),
        };
      },
      { domains: [], emails: [] }, // can't read the rules: don't lock everyone out
    ),
  );
}

async function isSuperadmin(userId: string) {
  return cached(`admin:${userId}`, 60_000, async () => {
    try {
      const { data } = await createAdminClient().from("profiles").select("is_superadmin").eq("id", userId).maybeSingle();
      return data?.is_superadmin === true;
    } catch {
      return false;
    }
  });
}

/**
 * Whether this account may use the site: whitelisted email, or an allowed domain (subdomains count),
 * or a superadmin. If no rules are configured at all, everyone is allowed.
 */
export async function isAllowedUser(userId: string, email: string | null | undefined): Promise<boolean> {
  const rules = await loadSignupRules();
  if (!rules.domains.length && !rules.emails.length) return true;
  const address = (email ?? "").trim().toLowerCase();
  const domain = address.split("@")[1] ?? "";
  if (address && rules.emails.includes(address)) return true;
  if (domain && rules.domains.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  return isSuperadmin(userId);
}
