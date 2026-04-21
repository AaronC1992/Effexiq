/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing the Howler audio library which uses browser globals
  // eslint-disable-next-line no-unused-vars
  webpack(config, { isServer }) {
    if (isServer) {
      // Howler and audio APIs are browser-only – mark as false so Webpack
      // replaces imports with an empty module instead of referencing a
      // non-existent global (the 'Howl' global does not exist server-side).
      config.externals = [
        ...(config.externals || []),
        { howler: false },
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https://pub-b8fe695f5b4b490ebe0dc151042193e2.r2.dev",
              "connect-src 'self' https://plausible.io https://*.supabase.co wss://*.supabase.co https://api.openai.com https://pixabay.com https://irc-ws.chat.twitch.tv",
              "font-src 'self'",
              "worker-src 'self' blob:",
              "frame-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
