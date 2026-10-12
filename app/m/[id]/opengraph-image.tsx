import { ImageResponse } from "next/og";
import { getCaptionMeme } from "@/lib/memes";

// The preview picture shown when a meme link is pasted into a chat or post:
// the caption on top and the photo underneath, the same layout as the site.
export const alt = "A meme from Lion Laughs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getCaptionMeme(id);
  const caption = item?.content ?? "Lion Laughs";
  const photo = item?.memes?.image_url;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#111" }}>
        <div
          style={{
            display: "flex",
            padding: "28px 48px",
            background: "#fbfaf4",
            color: "#17221b",
            fontSize: caption.length > 80 ? 38 : 46,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {caption}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : null}
        </div>
        <div style={{ display: "flex", position: "absolute", right: 24, bottom: 18, color: "#d7f36b", fontSize: 26, fontWeight: 700 }}>
          Lion Laughs
        </div>
      </div>
    ),
    { ...size },
  );
}
