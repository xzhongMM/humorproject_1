import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let authError = searchParams.get("error_description")
    ?? searchParams.get("error")
    ?? searchParams.get("error_code");

  if (code) {
    const cookieStore = await cookies();
    const dashboardResponse = NextResponse.redirect(new URL("/dashboard", origin));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            dashboardResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) =>
            dashboardResponse.headers.set(name, value),
          );
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return dashboardResponse;
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
