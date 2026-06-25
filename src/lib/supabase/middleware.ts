import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DASHBOARD_HOST, isDashboardHost } from "@/lib/dashboard";

// Public routes reachable without a session (main site).
const PUBLIC_PATHS = ["/login", "/register", "/reset", "/cere-invitatie"];

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

  // Auth callback (recovery / email link) exchanges a code for a session — it
  // must run even without a prior session, so never redirect it.
  if (path.startsWith("/auth")) {
    return supabaseResponse;
  }

  // Email-change activation link from the inbox: a token-gated page that must be
  // reachable by anyone (the user is usually NOT logged in when they click it),
  // and not bounced home for logged-in users either.
  if (path === "/confirm-email") {
    return supabaseResponse;
  }

  // Block + forced-sign-out enforcement: kick the user on their next request
  // even if their access token is still valid. account_gate reports the block
  // state and whether the session still exists (sign-out/block delete it).
  //
  // GET only: navigations get redirected here. Server actions are POSTs —
  // redirecting them returns HTML to a fetch caller ("unexpected response"), so
  // those are enforced inside the action (requireActiveUser) instead, which
  // returns a flag the client uses to navigate.
  const userId = data?.claims?.sub as string | undefined;
  if (userId && request.method === "GET") {
    const { data: rows } = await supabase.rpc("account_gate");
    const gate = (Array.isArray(rows) ? rows[0] : rows) as
      | { blocked_until: string | null; session_active: boolean }
      | undefined;

    const blocked =
      !!gate?.blocked_until && new Date(gate.blocked_until).getTime() > Date.now();
    const signedOut = gate?.session_active === false;

    if (blocked || signedOut) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return copyCookies(NextResponse.redirect(url), supabaseResponse);
    }
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
