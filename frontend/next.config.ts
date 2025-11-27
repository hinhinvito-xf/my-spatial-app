import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // We keep this to ignore TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;