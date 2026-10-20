import type { NextConfig } from "next";

const configuredSupabaseHost = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "https:" ? url.hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Proxy preserves /staff/ (the accepted manifest start URL) while retaining
  // slashless redirects for every other route.
  skipTrailingSlashRedirect: true,
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
      // Generic Marketing uploads allow 10 MB source files; multipart framing
      // needs headroom. The server validates bytes and dimensions before storage.
      bodySizeLimit: "12mb",
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
        // Narrow Staff scanner route policy: only scanner routes permit same-origin camera.
        // Central Staff SCAN navigation performs a document navigation so this policy is loaded.
        source: "/staff/scan/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        source: "/:serviceWorker(sw|staff-sw|cradlehub-push-sw).js",
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
      ...(configuredSupabaseHost && configuredSupabaseHost !== "lsrbwqhvzjfpiabeolkv.supabase.co"
        ? [
            {
              protocol: "https" as const,
              hostname: configuredSupabaseHost,
              pathname: "/storage/**",
            },
          ]
        : []),
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
