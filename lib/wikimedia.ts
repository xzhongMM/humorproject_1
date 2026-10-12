// Picks "reaction"-style meme photos for the daily bot: expressive animals, people reacting, and big emoji.
// Photos come from Wikimedia Commons (CC-licensed / public domain) and emoji from Google's Noto Emoji
// (Apache 2.0), so everything can be reused with credit. No copyrighted meme templates.

const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT || "LionLaughsMemeBot/1.0 (student class project; https://github.com/xzhongMM/humorproject_1)";

// Expressive animals: the classic "this is me" meme energy (and very NYC: pigeons, rats, squirrels).
const ANIMAL_SEARCHES = [
  "cat yawning",
  "surprised cat",
  "cat staring",
  "angry cat hissing",
  "dog head tilt",
  "dog sleeping funny",
  "shiba inu",
  "pug face",
  "raccoon",
  "squirrel eating",
  "pigeon New York City",
  "brown rat",
  "owl staring",
  "goat screaming",
  "capybara",
  "seal pup",
  "frog close-up",
  "sloth",
  "otter",
  "llama face",
];

// Adults with readable reactions. (No children, no searches for specific or famous people.)
const PEOPLE_SEARCHES = [
  "facepalm",
  "man yawning",
  "woman laughing",
  "shocked face man",
  "surprised woman face",
  "student sleeping library",
  "man thinking",
  "woman shrugging",
  "tired student",
  "person screaming",
];

// Noto Emoji code points (rendered as 512px PNGs).
const EMOJI = [
  ["1f62d", "loudly crying face"],
  ["1f480", "skull"],
  ["1f644", "eye roll"],
  ["1f62c", "grimacing face"],
  ["1f633", "flushed face"],
  ["1f972", "smiling face with tear"],
  ["1f921", "clown face"],
  ["1f60e", "sunglasses face"],
  ["1f92f", "exploding head"],
  ["1f971", "yawning face"],
  ["1f97a", "pleading face"],
  ["1fae0", "melting face"],
  ["1f914", "thinking face"],
  ["1f643", "upside-down face"],
  ["1f62e", "open mouth face"],
  ["1f928", "raised eyebrow"],
  ["1f974", "woozy face"],
  ["1f610", "neutral face"],
  ["1f979", "holding back tears"],
  ["1f92a", "zany face"],
  ["1f913", "nerd face"],
  ["1f9d0", "face with monocle"],
  ["1f624", "face with steam"],
  ["1f976", "freezing face"],
  ["1f975", "overheated face"],
];

export type Photo = {
  sourceUrl: string; // original page (also used to avoid repeats)
  imageUrl: string; // the file we download
  mime: string;
  credit: string;
  kind: "animal" | "person" | "emoji";
};

const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

type CommonsPage = {
  imageinfo?: {
    thumburl?: string;
    descriptionurl: string;
    mime: string;
    width: number;
    height: number;
    extmetadata?: Record<string, { value?: string }>;
  }[];
};

async function searchCommons(term: string, kind: Photo["kind"]): Promise<Photo[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${term} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "30",
    gsroffset: String(Math.floor(Math.random() * 3) * 30),
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "960",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const json = await res.json();
  const pages: CommonsPage[] = json?.query?.pages ?? [];
  return pages.flatMap((p) => {
    const info = p.imageinfo?.[0];
    if (!info?.thumburl || !["image/jpeg", "image/png"].includes(info.mime)) return [];
    const ratio = info.width / info.height;
    if (info.width < 500 || ratio < 0.6 || ratio > 1.9) return [];
    const meta = info.extmetadata ?? {};
    const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "Unknown author";
    const license = stripHtml(meta.LicenseShortName?.value) || "see source";
    return [{
      sourceUrl: info.descriptionurl,
      imageUrl: info.thumburl,
      mime: info.mime,
      credit: `${artist} / ${license} via Wikimedia Commons`,
      kind,
    }];
  });
}

function emojiPhoto(code: string, name: string): Photo {
  return {
    sourceUrl: `https://github.com/googlefonts/noto-emoji/blob/main/png/512/emoji_u${code}.png`,
    imageUrl: `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/512/emoji_u${code}.png`,
    mime: "image/png",
    credit: `Noto Emoji "${name}" / Apache 2.0, Google`,
    kind: "emoji",
  };
}

/** Picks `count` unused reaction photos: roughly 2 animals, 2 people, 1 emoji per day. */
export async function pickPhotos(count: number, alreadyUsed: Set<string>): Promise<Photo[]> {
  const plan: Photo["kind"][] = shuffle(["animal", "animal", "person", "person", "emoji"]);
  while (plan.length < count) plan.push("animal");
  const wanted = plan.slice(0, count);
  const need = (k: Photo["kind"]) => wanted.filter((x) => x === k).length;

  // Run all searches at the same time (not one after another) so the bot finishes quickly.
  const searchMany = async (terms: string[], kind: Photo["kind"], n: number) =>
    n === 0 ? [] : (await Promise.all(shuffle(terms).slice(0, n + 2).map((t) => searchCommons(t, kind)))).map(shuffle);
  const [animalPools, peoplePools] = await Promise.all([
    searchMany(ANIMAL_SEARCHES, "animal", need("animal")),
    searchMany(PEOPLE_SEARCHES, "person", need("person")),
  ]);

  // Take one photo per search term (more variety), skipping anything already used.
  const takeFrom = (pools: Photo[][]) => {
    for (const pool of pools) {
      const choice = pool.find((p) => !alreadyUsed.has(p.sourceUrl));
      if (choice) {
        pools.splice(pools.indexOf(pool), 1);
        return choice;
      }
    }
    return undefined;
  };
  const emojis = shuffle(EMOJI).map(([c, n]) => emojiPhoto(c, n));

  const picked: Photo[] = [];
  for (const kind of wanted) {
    const choice =
      kind === "emoji" ? emojis.find((p) => !alreadyUsed.has(p.sourceUrl))
      : kind === "animal" ? takeFrom(animalPools) ?? takeFrom(peoplePools)
      : takeFrom(peoplePools) ?? takeFrom(animalPools);
    if (choice) {
      alreadyUsed.add(choice.sourceUrl);
      picked.push(choice);
    }
  }
  return picked;
}

export async function downloadPhoto(photo: Photo): Promise<Buffer> {
  const res = await fetch(photo.imageUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
