import type { NextConfig } from "next";

const config: NextConfig = {
  // Let Node load Deep Agents' optional integrations instead of bundling missing optional peers.
  serverExternalPackages: ["deepagents"],
  turbopack: { root: process.cwd() },
  // With THESYS_BASE_URL set, such as a local stack, the browser reaches it through this app's
  // origin, so it needs no CORS setup. The page tells the browser to do so.
  async rewrites() {
    const base = process.env.THESYS_BASE_URL?.replace(/\/+$/, "");
    return base ? [{ source: "/v1/:path*", destination: `${base}/v1/:path*` }] : [];
  },
};

export default config;
