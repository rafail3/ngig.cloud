import type { NextConfig } from "next";
import { createRequire } from "node:module";

const isProd = process.env.NODE_ENV === "production";

// App version, read from package.json at build time. release-please bumps this
// on every release, so exposing it as a NEXT_PUBLIC_ env makes the deployed
// version show up in the UI and refresh on each prod deploy.
const pkg = createRequire(import.meta.url)("./package.json") as { version: string };

// The self-hosted OnlyOffice Document Server. Its editor is an iframe that pulls
// its own scripts, styles, fonts and sockets from that origin, so every directive
// below has to know about it — otherwise the editor silently fails to load, and
// only in production (the CSP is prod-only).
//
// Its exact address is a RUNTIME setting (the server can sit behind a tunnel
// whose URL changes on every reboot), but a CSP is baked at build time — so we
// allow the host patterns it may appear under rather than one fixed URL:
//   *.trycloudflare.com  — the free Cloudflare tunnel used while the Document
//                          Server lives on a machine without a public IP;
//   office.ngig.cloud    — the permanent home once it moves to a real host.
// OFFICE_CSP_ORIGINS (space-separated) can add more without a code change.
const officeOrigins = [
  "https://*.trycloudflare.com",
  "https://office.ngig.cloud",
  process.env.NEXT_PUBLIC_ONLYOFFICE_URL?.replace(/\/$/, ""),
  ...(process.env.OFFICE_CSP_ORIGINS?.split(/\s+/) ?? []),
].filter((o): o is string => Boolean(o));

const office = officeOrigins.length ? ` ${officeOrigins.join(" ")}` : "";
// The editor holds a WebSocket open for co-editing, on the same hosts.
const officeWs = officeOrigins.length
  ? ` ${officeOrigins.map((o) => o.replace(/^http/, "ws")).join(" ")}`
  : "";

// Lock outbound connections to the only hosts we talk to. Tightening script-src
// to a nonce (dropping 'unsafe-inline') is a future hardening step.
const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the Shiki code highlighter instantiate its inlined
  // WebAssembly grammar engine. It permits WASM only — NOT string eval().
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com${office}`,
  `style-src 'self' 'unsafe-inline'${office}`,
  `img-src 'self' data: blob: https://*.backblazeb2.com${office}`,
  // Audio/video previews stream straight from B2.
  "media-src 'self' blob: https://*.backblazeb2.com",
  `font-src 'self' data:${office}`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.backblazeb2.com https://challenges.cloudflare.com${office}${officeWs}`,
  // PDF print spins up a hidden same-origin blob iframe of the document.
  `frame-src 'self' blob: https://challenges.cloudflare.com https://*.backblazeb2.com${office}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; "); 

const securityHeaders = [
  // Force HTTPS for two years, including subdomains (preload-eligible).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // CSP only in production — Turbopack's dev HMR needs inline/eval it would block.
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },

  // Partial Prerendering: every page ships an instant static shell and streams
  // its uncached (per-user / B2 / Supabase) data behind <Suspense>. Makes
  // client navigation between pages feel instant. See reference-nav-performance.
  cacheComponents: true,

  experimental: {
    // Adds the "Instant Navs" panel to the Next.js DevTools so we can freeze a
    // page at its static shell and verify what renders before data streams in.
    instantNavigationDevToolsToggle: true,

    // Keep visited pages' rendered segments in the client router cache so going
    // back to a page (within the window) is instant — no skeleton, no server
    // roundtrip. By default dynamic segments aren't cached (TTL 0), which is why
    // every revisit re-streamed. Mutations still clear this cache immediately
    // (revalidatePath / updateTag), so the user's own changes stay fresh.
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },

  // Allow accessing the dev server from the LAN (e.g. phone on same Wi-Fi)
  // without Next blocking HMR/font cross-origin requests. Dev-only.
  allowedDevOrigins: ["192.168.1.2"],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
