"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) setError(error.message);
    else router.push("/login");
  }

  return <span><button className="text-button" onClick={signOut}>Sign out</button>{error && <span className="form-error"> {error}</span>}</span>;
}
