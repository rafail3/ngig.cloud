// Host of the admin dashboard. Served from the SAME Next app as the main site;
// the proxy middleware routes this host into the /dashboard route tree.
// Override per-env with NEXT_PUBLIC_DASHBOARD_HOST (e.g. a Vercel preview URL).
export const DASHBOARD_HOST =
  process.env.NEXT_PUBLIC_DASHBOARD_HOST ?? "dashboard.ngig.cloud";

// True when the request's Host header targets the dashboard subdomain.
// Compares hostname only (strips :port on BOTH sides — DASHBOARD_HOST may
// include a port locally, e.g. dashboard.localhost:3002).
export function isDashboardHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host.split(":")[0].toLowerCase() === DASHBOARD_HOST.split(":")[0].toLowerCase();
}

// Absolute origin of the dashboard (with port locally). Used for links to it.
export function dashboardOrigin(): string {
  const proto = DASHBOARD_HOST.includes("localhost") ? "http" : "https";
  return `${proto}://${DASHBOARD_HOST}`;
}

// Host of the main app, derived by stripping the `dashboard.` prefix off the
// dashboard host — so it follows every environment for free (prod
// `dashboard.ngig.cloud` → `ngig.cloud`, local `dashboard.localhost:3002` →
// `localhost:3002`) with no extra env var to keep in sync. Falls back to the
// production host if the dashboard host isn't prefixed as expected.
export const APP_HOST = DASHBOARD_HOST.startsWith("dashboard.")
  ? DASHBOARD_HOST.slice("dashboard.".length)
  : "ngig.cloud";

// Absolute origin of the main app. Needed when linking to it from code that may
// run on the dashboard host (e.g. a notification for the ticket's owner that an
// admin's action created) — a bare path would resolve against the wrong host.
export function appOrigin(): string {
  const proto = APP_HOST.includes("localhost") ? "http" : "https";
  return `${proto}://${APP_HOST}`;
}
