"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (message) setError(message);
  }, []);

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Lion Laughs</p>
        <h1>Welcome back.</h1>
        <p>Sign in to make AI memes and vote on the funniest captions.</p>
        <button className="primary-button" onClick={signInWithGoogle}>Continue with Google</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
