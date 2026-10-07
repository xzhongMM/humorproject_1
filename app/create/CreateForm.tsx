"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { VIBES } from "@/lib/vibes";

// Shrink big phone photos before upload: faster, cheaper for the AI, and fits storage limits.
async function downscale(file: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that image."))), "image/jpeg", 0.85),
  );
}

export default function CreateForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [vibe, setVibe] = useState<string>(VIBES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pick(f?: File) {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("That's not an image.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return setError("Pick a photo first.");
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", new File([await downscale(file)], "meme.jpg", { type: "image/jpeg" }));
      body.append("vibe", vibe);
      const res = await fetch("/api/generate", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      router.push(`/?sort=new#caption-${json.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <label className="drop-zone">
        {preview ? <img src={preview} alt="Your upload" /> : <span>Tap to choose a photo</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      <fieldset className="vibe-picker" disabled={busy}>
        <legend>Vibe</legend>
        {VIBES.map((v) => (
          <label key={v.id} className={vibe === v.id ? "vibe-chip active" : "vibe-chip"}>
            <input type="radio" name="vibe" value={v.id} checked={vibe === v.id} onChange={() => setVibe(v.id)} />
            {v.label}
          </label>
        ))}
      </fieldset>

      <button className="primary-button" disabled={busy || !file}>{busy ? "Cooking a caption…" : "Generate meme"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
