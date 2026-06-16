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
