import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Lock outbound connections to the only hosts we talk to. Tightening script-src
// to a nonce (dropping 'unsafe-inline') is a future hardening step.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.backblazeb2.com",
  // Audio/video previews stream straight from B2.
  "media-src 'self' blob: https://*.backblazeb2.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.backblazeb2.com https://challenges.cloudflare.com",
  // PDF previews are embedded in an iframe pointing at a presigned B2 URL.
  "frame-src 'self' https://challenges.cloudflare.com https://*.backblazeb2.com",
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
  // Allow accessing the dev server from the LAN (e.g. phone on same Wi-Fi)
  // without Next blocking HMR/font cross-origin requests. Dev-only.
  allowedDevOrigins: ["192.168.1.2"],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
