import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// No OpenAI origin is in connect-src: v1 has no browser-to-OpenAI traffic.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ''}`,
  "media-src 'self' blob:",
  "img-src 'self' data: blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self), camera=(), geolocation=()',
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // No Service-Worker-Allowed header: the SW's scope stays at its
        // default (its own directory), which is all this app needs.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

export default nextConfig;
