/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Enable static export for CDN hosting
  images: {
    unoptimized: true, // Required for static export
  },
  turbopack: {}, // Empty config to silence Turbopack warning
};

export default nextConfig;
