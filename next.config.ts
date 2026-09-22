import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  agentRules: false,
  // 20 MB map images (datenmodell) plus multipart overhead.
  serverActions: {
    bodySizeLimit: "21mb",
  },
  experimental: {
    proxyClientMaxBodySize: "21mb",
  },
};

export default nextConfig;
