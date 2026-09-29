"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ProfileForm({
  userId,
  firstName,
  lastName,
  avatarUrl,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
}) {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      first_name: first.trim() || null,
      last_name: last.trim() || null,
      avatar_url: avatar || null,
    });
    setMessage(error ? error.message : "Profile saved.");
    setBusy(false);
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) || file.size > 5 * 1024 * 1024) {
      setMessage("Choose a JPEG, PNG, WebP, or GIF image smaller than 5 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatar(data.publicUrl);
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      first_name: first.trim() || null,
      last_name: last.trim() || null,
      avatar_url: data.publicUrl,
    });
    setMessage(profileError ? profileError.message : "Photo uploaded and profile saved.");
    setBusy(false);
  }

  return (
    <form className="profile-form" onSubmit={saveProfile}>
      <div className="avatar-row">
        {avatar ? <img className="avatar" src={avatar} alt="Your profile" /> : <div className="avatar avatar-empty" aria-hidden="true">+</div>}
        <label className="upload-label">Upload a photo
          <input type="file" accept="image/*" disabled={busy} onChange={(event) => uploadAvatar(event.target.files?.[0])} />
        </label>
      </div>
      <label htmlFor="first-name">First name</label>
      <input id="first-name" autoComplete="given-name" value={first} onChange={(event) => setFirst(event.target.value)} required />
      <label htmlFor="last-name">Last name</label>
      <input id="last-name" autoComplete="family-name" value={last} onChange={(event) => setLast(event.target.value)} required />
      <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  );
}
