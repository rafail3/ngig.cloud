import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow accessing the dev server from the LAN (e.g. phone on same Wi-Fi)
  // without Next blocking HMR/font cross-origin requests. Dev-only.
  allowedDevOrigins: ["192.168.1.2"],
};

export default nextConfig;
