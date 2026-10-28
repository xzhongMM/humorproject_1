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
type VibeText = { label: string; hint: string };

// `vibe` can be passed in when it comes from the database (see lib/config.ts).
export function buildPrompt(vibeId: string, vibe: VibeText = VIBES.find((v) => v.id === vibeId) ?? VIBES[0]) {
  const prompt = [
    "You are a meme caption writer for college students at Columbia University in New York City.",
    `Write ONE short, funny meme caption for the attached photo in the vibe "${vibe.label}" (${vibe.hint}).`,
    "Rules: the caption must clearly relate to what is visible in the photo; max 120 characters;",
    "pick whichever format fits best (POV, 'me when', 'nobody:', dialogue, plain one-liner); no hashtags; no emojis;",
    "keep it playful, never mean-spirited, hateful, or sexual. Return JSON: {\"caption\": \"...\"}.",
  ].join(" ");
  return { vibe, prompt };
}

// Prompt for the daily bot: a reaction photo (animal / person / emoji) + what r/columbia is talking about.
// The photo is the *reaction*; the caption supplies the Columbia situation ("me when...", "POV:", etc.).
export function buildBotPrompt(
  topics: string[],
  kind: "animal" | "person" | "emoji" = "animal",
  vibe: VibeText = VIBES[Math.floor(Math.random() * VIBES.length)],
) {
  const sample = [...topics].sort(() => Math.random() - 0.5).slice(0, 5);
  const topicBlock = sample.length
    ? `Here is what Columbia students are posting about on r/columbia this week (inspiration only):\n${sample.map((t) => `- ${t}`).join("\n")}\n` +
      "Build the situation from ONE of these topics if one fits naturally; otherwise use everyday Columbia student life."
    : "Build the situation from everyday Columbia student life.";
  const subject = { animal: "an animal", person: "a person", emoji: "an emoji" }[kind];
  const prompt = [
    "You are a meme caption writer for college students at Columbia University in New York City.",
    `The attached image is a reaction image: ${subject} with a strong expression or vibe.`,
    "Treat the image as the punchline/reaction. Write ONE caption that sets up a relatable Columbia situation",
    `that this reaction perfectly matches, in the vibe "${vibe.label}" (${vibe.hint}).`,
    "Use classic reaction-meme formats like 'me when...', 'POV:', 'my face when...', 'nobody: / me:', or",
    "'[thing] be like'. Do NOT just describe what's in the image.",
    topicBlock,
    "Rules: never quote a post word for word; never mention usernames, real names, or identifiable people;",
    "don't mock the person in the photo, any individual, or any group; avoid politics, protests, tragedies, crime,",
    "and health crises; max 120 characters; no hashtags; no emojis.",
    'Return JSON: {"caption": "..."}.',
  ].join("\n");
  return { vibe, prompt };
}
