// Pulls recent r/columbia post titles to use as *topic inspiration* for captions.
// We never store or display the posts themselves: no usernames, no links, no verbatim quotes.

const USER_AGENT = process.env.REDDIT_USER_AGENT || "web:lion-laughs-meme-bot:1.0 (student class project)";

// Skip posts about tragedies, crime, politics, or health crises. Those aren't meme material.
const SENSITIVE =
  /\b(die[ds]?|death|dead|suicid|self.?harm|assault|harass|rape|shoot|stab|arrest|police|nypd|crime|robbe|overdose|missing|hospital|protest|encampment|israel|palestin|gaza|hamas|antisemit|islamophob|racis|deport|visa|lawsuit|trump|election|abuse|grief|funeral|cancer)\w*/i;

type RedditPost = {
  title: string;
  selftext?: string;
  over_18?: boolean;
  stickied?: boolean;
  removed_by_category?: string | null;
  created_utc: number;
};

async function fetchListing(): Promise<RedditPost[]> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  let url = "https://www.reddit.com/r/columbia/new.json?limit=50&raw_json=1";
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };

  // Preferred: an official Reddit app (application-only OAuth). Reddit often blocks
  // anonymous requests that come from cloud servers like Vercel.
  if (id && secret) {
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        ...headers,
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (tokenRes.ok) {
      const { access_token } = await tokenRes.json();
      headers.Authorization = `Bearer ${access_token}`;
      url = "https://oauth.reddit.com/r/columbia/new?limit=50&raw_json=1";
    }
  }

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  const json = await res.json();
  return (json?.data?.children ?? []).map((c: { data: RedditPost }) => c.data);
}

function clean(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\/?u\/[\w-]+/gi, "someone")
    .replace(/\S+@\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns up to 15 short, safe topic lines from the past week of r/columbia. Empty on any failure. */
export async function fetchColumbiaTopics(): Promise<string[]> {
  try {
    const weekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
    const posts = await fetchListing();
    return posts
      .filter((p) => !p.over_18 && !p.stickied && !p.removed_by_category && p.created_utc >= weekAgo)
      .filter((p) => !SENSITIVE.test(`${p.title} ${p.selftext ?? ""}`))
      .map((p) => {
        const body = clean(p.selftext ?? "").slice(0, 140);
        return clean(p.title).slice(0, 140) + (body ? ` (${body})` : "");
      })
      .filter((t) => t.length > 8)
      .slice(0, 15);
  } catch (e) {
    console.error("Could not load r/columbia topics:", e);
    return [];
  }
}
