// Caption "vibes" tuned for Sam: a chronically online Columbia junior from the Midwest, new to NYC.
export const VIBES = [
  { id: "dorm", label: "Columbia dorm life", hint: "dorm rooms, John Jay/Ferris dining, Butler library all-nighters, roommates, Low Steps" },
  { id: "midwest", label: "Midwest kid in NYC", hint: "a Midwesterner new to New York: culture shock, prices, subway confusion, missing Target and ranch" },
  { id: "online", label: "Chronically online", hint: "current internet slang and meme formats, group-chat energy, ironic and terminally online" },
  { id: "weekend", label: "Weekend in the city", hint: "exploring NYC on weekends: bodegas, the MTA, brunch lines, Central Park, overpriced matcha" },
  { id: "finals", label: "Midterms & finals despair", hint: "academic stress, Core classes, problem sets, office hours, deadlines, caffeine" },
  { id: "unhinged", label: "Unhinged", hint: "absurd, surreal, chaotic humor that still relates to the photo" },
] as const;

export type VibeId = (typeof VIBES)[number]["id"];

export function buildPrompt(vibeId: string) {
  const vibe = VIBES.find((v) => v.id === vibeId) ?? VIBES[0];
  const prompt = [
    "You are a meme caption writer for college students at Columbia University in New York City.",
    `Write ONE short, funny meme caption for the attached photo in the vibe "${vibe.label}" (${vibe.hint}).`,
    "Rules: the caption must clearly relate to what is visible in the photo; max 120 characters;",
    "pick whichever format fits best (POV, 'me when', 'nobody:', dialogue, plain one-liner); no hashtags; no emojis;",
    "keep it playful, never mean-spirited, hateful, or sexual. Return JSON: {\"caption\": \"...\"}.",
  ].join(" ");
  return { vibe, prompt };
}
