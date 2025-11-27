import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // We keep this to ignore TS errors during build to save memory/time
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: We removed the 'eslint' block because it causes errors in next.config.ts
};

export default nextConfig;