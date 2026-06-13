import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes reachable without a session.
const PUBLIC_PATHS = ["/login", "/register"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims — it refreshes
  // the auth token. getClaims() verifies the JWT (never trust getSession here).
  const { data } = await supabase.auth.getClaims();
  const isAuthed = Boolean(data?.claims);

  const path = request.nextUrl.pathname;

  // API routes manage their own auth — never redirect them (a redirect would
  // return HTML and break fetch/JSON callers like the username check).
  if (path.startsWith("/api")) {
    return supabaseResponse;
  }

  const isPublic = PUBLIC_PATHS.includes(path);

  // Unauthenticated → push to /login (except on public routes).
  if (!isAuthed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting login/register → send home.
  if (isAuthed && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
