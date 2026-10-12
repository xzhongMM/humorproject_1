// Finds freely licensed Columbia / Morningside / NYC photos on Wikimedia Commons.
// Commons images are CC-licensed or public domain, so we can reuse them with credit.

const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT || "LionLaughsMemeBot/1.0 (student class project; https://github.com/xzhongMM/humorproject_1)";

// Mostly places and scenes, not people, so no one's face ends up in a meme without consent.
const SEARCHES = [
  "Columbia University Butler Library",
  "Low Memorial Library Columbia",
  "Columbia University campus College Walk",
  "Alma Mater statue Columbia University",
  "Columbia University snow campus",
  "Columbia University Low Steps",
  "Morningside Heights Broadway",
  "116th Street Columbia University subway station",
  "Morningside Park Manhattan",
  "Riverside Park Manhattan",
  "Cathedral of Saint John the Divine",
  "Barnard College campus",
  "Columbia University John Jay Hall",
  "Central Park autumn",
  "New York City subway car interior",
  "New York City bodega",
  "Columbia University Pupin Hall",
  "Columbia University Philosophy Hall",
];

export type Photo = {
  sourceUrl: string; // Commons file page (also used to avoid repeats)
  imageUrl: string; // ~1280px rendition we download
  mime: string;
  credit: string; // "Author / License via Wikimedia Commons"
};

const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

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

async function search(term: string): Promise<Photo[]> {
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
    iiurlwidth: "1280",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  const pages: CommonsPage[] = json?.query?.pages ?? [];
  return pages.flatMap((p) => {
    const info = p.imageinfo?.[0];
    if (!info?.thumburl || !["image/jpeg", "image/png"].includes(info.mime)) return [];
    const ratio = info.width / info.height;
    if (info.width < 800 || ratio < 0.6 || ratio > 2) return [];
    const meta = info.extmetadata ?? {};
    const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "Unknown author";
    const license = stripHtml(meta.LicenseShortName?.value) || "see source";
    return [{ sourceUrl: info.descriptionurl, imageUrl: info.thumburl, mime: info.mime, credit: `${artist} / ${license} via Wikimedia Commons` }];
  });
}

/** Picks `count` random photos that haven't been used before. */
export async function pickPhotos(count: number, alreadyUsed: Set<string>): Promise<Photo[]> {
  const terms = [...SEARCHES].sort(() => Math.random() - 0.5).slice(0, Math.min(SEARCHES.length, count + 3));
  const picked: Photo[] = [];
  for (const term of terms) {
    if (picked.length >= count) break;
    const fresh = (await search(term)).filter((p) => !alreadyUsed.has(p.sourceUrl));
    if (fresh.length === 0) continue;
    const choice = fresh[Math.floor(Math.random() * fresh.length)];
    alreadyUsed.add(choice.sourceUrl);
    picked.push(choice); // one photo per search term = more variety
  }
  return picked;
}

export async function downloadPhoto(photo: Photo): Promise<Buffer> {
  const res = await fetch(photo.imageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
