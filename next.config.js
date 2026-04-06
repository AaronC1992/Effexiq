/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing the Howler audio library which uses browser globals
  // eslint-disable-next-line no-unused-vars
  webpack(config, { isServer }) {
    if (isServer) {
      // Howler and audio APIs are browser-only – never bundle for the server
      config.externals = [
        ...(config.externals || []),
        { howler: 'Howl' },
      ];
    }
    return config;
  },

  // Proxy R2 audio through Next.js to avoid CORS issues with pub-*.r2.dev
  async rewrites() {
    const r2Base = process.env.R2_PUBLIC_URL || 'https://pub-b8fe695f5b4b490ebe0dc151042193e2.r2.dev';
    return [
      {
        source: '/r2-audio/:path*',
        destination: `${r2Base}/:path*`,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
