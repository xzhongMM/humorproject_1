import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let authError = searchParams.get("error_description")
    ?? searchParams.get("error")
    ?? searchParams.get("error_code");

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL("/dashboard", origin));
    }
    authError = error.message;
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set(
    "error",
    authError || "Supabase returned to /auth/callback without an authorization code. Add http://localhost:3000/auth/callback under Supabase Authentication > URL Configuration > Redirect URLs.",
  );
  return NextResponse.redirect(loginUrl);
}
