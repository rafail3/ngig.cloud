import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DASHBOARD_HOST, isDashboardHost } from "@/lib/dashboard";

// Public routes reachable without a session (main site).
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

  // ---- Dashboard subdomain --------------------------------------------------
  // Cookies are host-only, so the dashboard host has its own session, separate
  // from the main site. Admin-gating happens at login + in the panel layout.
  if (isDashboardHost(request.headers.get("host"))) {
    return dashboardFlow(request, isAuthed, supabaseResponse);
  }

  // ---- Main site ------------------------------------------------------------
  // The /dashboard tree is reachable only via the subdomain. If someone hits it
  // on the apex host, bounce them to the real dashboard URL.
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    const rest = path.replace(/^\/dashboard/, "") || "/";
    return NextResponse.redirect(`https://${DASHBOARD_HOST}${rest}`, 308);
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

// On the dashboard host the browser sees clean paths ("/", "/invites", "/login").
// Internally those map to the /dashboard route tree. `/dashboard/login` is the
// only public path; everything else needs a session (admin enforced in layout).
function dashboardFlow(
  request: NextRequest,
  isAuthed: boolean,
  baseResponse: NextResponse,
) {
  const path = request.nextUrl.pathname;
  const isPublic = path === "/login";

  // Unauthenticated → login.
  if (!isAuthed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return copyCookies(NextResponse.redirect(url), baseResponse);
  }

  // Authenticated user hitting the login page → home.
  if (isAuthed && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return copyCookies(NextResponse.redirect(url), baseResponse);
  }

  // Serve the dashboard tree without exposing the /dashboard prefix in the URL.
  const url = request.nextUrl.clone();
  url.pathname = path === "/" ? "/dashboard" : `/dashboard${path}`;
  return copyCookies(NextResponse.rewrite(url), baseResponse);
}

// Carry over any auth cookies refreshed by getClaims onto a redirect/rewrite.
function copyCookies(target: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}
