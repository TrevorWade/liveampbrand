// This file configures Next.js for our T-shirt designer app.
// We mark konva as an external package on the server so SSR does not bundle canvas binaries.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep server-side builds clean when using react-konva on client components.
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
