/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Save memory by disabling type checking during production build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Save memory by disabling linting during production build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Reduce memory usage by disabling source maps in production
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;