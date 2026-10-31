/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Standalone output: self-contained server bundle. Also sidesteps a
  // Vercel collector bug that demands the legacy export-detail.json,
  // which server-mode builds (correctly) never emit.
  output: 'standalone',
};

export default nextConfig;
