// Next.js config for the T-shirt designer (Konva is client-only via dynamic import).
// Next 16 builds with Turbopack by default — a webpack-only config fails the Vercel build.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node `canvas` out of the Turbopack graph (Konva optionally requires it on the server).
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/empty-module.ts",
    },
  },
  // Still support `next build --webpack` / older tooling if someone opts into webpack.
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
