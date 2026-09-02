import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/**/*",
    ],
  },
  experimental: {
    // Cache dynamic (auth-gated) page payloads in the client-side router for
    // 2 minutes. Without this, every navigation re-fetches from the server
    // even if you were on the page 5 seconds ago.
    // Realtime subscriptions (router.refresh()) still invalidate the cache
    // immediately when data changes, so live pages stay accurate.
    staleTimes: {
      dynamic: 120, // seconds — dynamic/auth pages
      static: 300, // seconds — fully-static pages
    },
    serverActions: {
      // Set to 8mb to support the largest authorized Marketing media contract (HERO_BACKGROUND: 6MB)
      // with multipart form boundary overhead. Authoritative server-side validateMediaBuffer enforces
      // exact per-intent maxBytes thresholds (2MB - 6MB) before Storage upload or DB writes.
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        source: "/:serviceWorker(sw|cradlehub-push-sw).js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; connect-src 'self'",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/manager/resources",
        destination: "/manager/spaces-rules",
        permanent: false,
      },
    ];
  },
  images: {
    qualities: [75, 85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-**",
      },
      {
        protocol: "https",
        hostname: "lsrbwqhvzjfpiabeolkv.supabase.co",
        pathname: "/storage/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    // Avoid Windows/junction and multi-lockfile inference selecting src/app.
    // Builds and deployments run from the repository root.
    root: process.cwd(),
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
