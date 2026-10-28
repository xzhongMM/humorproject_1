import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isAllowedUser } from "@/lib/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  // Already signed in but no longer allowed (an admin changed the signup rules): sign out.
  const claims = data?.claims;
  if (claims?.sub && !(await isAllowedUser(claims.sub, claims.email))) {
    await supabase.auth.signOut();
    const refused = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "This account isn't allowed to use Lion Laughs." }, { status: 403 })
      : NextResponse.redirect(new URL("/login?error=not_allowed", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => refused.cookies.set(cookie));
    return refused;
  }

  return supabaseResponse
};