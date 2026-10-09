/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1'}/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['bootstrap', 'bootstrap-icons'],
  },
};

module.exports = nextConfig;
