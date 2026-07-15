import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// The self-hosted OnlyOffice Document Server, when configured. Its editor is an
// iframe that pulls its own scripts, styles, fonts and sockets from that origin,
// so every directive below has to know about it — otherwise the editor silently
// fails to load, and only in production (the CSP is prod-only).
const officeOrigin = process.env.NEXT_PUBLIC_ONLYOFFICE_URL?.replace(/\/$/, "") ?? "";
const office = officeOrigin ? ` ${officeOrigin}` : "";
const officeWs = officeOrigin ? ` ${officeOrigin.replace(/^http/, "ws")}` : "";

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
