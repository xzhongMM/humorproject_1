"use client";

import { useEffect, useRef, useState } from "react";

type Props = { captionId: string; caption: string; imageUrl?: string };

// Draws the finished meme (caption box on top, photo underneath) into a PNG,
// so apps like Instagram and WeChat get the whole meme, not just the bare photo.
async function renderMemeImage(caption: string, imageUrl: string): Promise<File | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Supabase Storage allows this, so the canvas stays exportable
    img.src = imageUrl;
    await img.decode();

    const W = 1080;
    const pad = 48;
    const font = "700 46px 'Space Grotesk', 'DM Sans', system-ui, sans-serif";
    const ctx0 = document.createElement("canvas").getContext("2d")!;
    ctx0.font = font;

    // Wrap the caption to the card width.
    const lines: string[] = [];
    let line = "";
    for (const word of caption.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx0.measureText(test).width > W - pad * 2 && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);

    const lineH = 58;
    const captionH = pad * 2 + lines.length * lineH - 12;
    const photoH = Math.round((img.naturalHeight / img.naturalWidth) * W);
    const footerH = 56;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = captionH + photoH + footerH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fbfaf4";
    ctx.fillRect(0, 0, W, captionH);
    ctx.fillStyle = "#17221b";
    ctx.font = font;
    ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, pad, pad + i * lineH));
    ctx.drawImage(img, 0, captionH, W, photoH);
    ctx.fillStyle = "#17221b";
    ctx.fillRect(0, captionH + photoH, W, footerH);
    ctx.fillStyle = "#d7f36b";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("Lion Laughs", pad, captionH + photoH + footerH / 2);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    return blob ? new File([blob], "lion-laughs-meme.png", { type: "image/png" }) : null;
  } catch {
    return null; // e.g. image blocked by CORS: we'll still share the link
  }
}

export default function ShareButton({ captionId, caption, imageUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const url = typeof window === "undefined" ? `/m/${captionId}` : `${window.location.origin}/m/${captionId}`;
  const text = `${caption}. Vote on it at Lion Laughs`;
  const enc = encodeURIComponent;

  useEffect(() => setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share), []);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    setCopied(false);
    // Build the meme image in the background as soon as the menu opens.
    if (next && !file && imageUrl) renderMemeImage(caption, imageUrl).then(setFile);
  }

  // Phone share sheet: Instagram, WeChat, Messages, Mail, WhatsApp, Snapchat... whatever is installed.
  async function nativeShare() {
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Lion Laughs", text: `${text}: ${url}` });
      } else {
        await navigator.share({ title: "Lion Laughs", text, url });
      }
      setOpen(false);
    } catch {
      /* user closed the share sheet */
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function download() {
    const f = file ?? (imageUrl ? await renderMemeImage(caption, imageUrl) : null);
    const href = f ? URL.createObjectURL(f) : imageUrl;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = "lion-laughs-meme.png";
    a.target = "_blank";
    a.click();
    if (f) setTimeout(() => URL.revokeObjectURL(href), 5000);
  }

  return (
    <div className="share-box" ref={boxRef}>
      <button className="vote-btn share-btn" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label="Share this meme" title="Share">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {canNativeShare && (
            <button role="menuitem" onClick={nativeShare}>
              Share to apps…<small>Instagram, WeChat, Messages & more</small>
            </button>
          )}
          <button role="menuitem" onClick={copyLink}>{copied ? "Link copied!" : "Copy link"}<small>Paste into WeChat, Discord, GroupMe…</small></button>
          <a role="menuitem" href={`sms:?&body=${enc(`${text}: ${url}`)}`}>Text message</a>
          <a role="menuitem" href={`mailto:?subject=${enc("A Columbia meme for you")}&body=${enc(`${text}\n\n${url}`)}`}>Email</a>
          <a role="menuitem" href={`https://wa.me/?text=${enc(`${text}: ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a role="menuitem" href={`https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer">X / Twitter</a>
          <a role="menuitem" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
          <button role="menuitem" onClick={download}>
            Download image<small>For Instagram stories or WeChat Moments</small>
          </button>
        </div>
      )}
    </div>
  );
}
