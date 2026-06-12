import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,

  // Support for large response bodies (analytics, CSV exports)
  serverExternalPackages: ["pino", "pino-pretty"],

  // Image optimization for merchant logos and offer images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [375, 640, 768, 1024, 1280, 1536],
    imageSizes: [32, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },

  // Compression for API responses
  compress: true,

  // HTTP headers for security
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // {
          //   key: "Content-Security-Policy",
          //   value: [
          //     "default-src 'self'",
          //     "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          //     "style-src 'self' 'unsafe-inline'",
          //     `img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in`,
          //     `connect-src 'self' http://localhost:54321 ws://localhost:54321 https://*.supabase.co https://*.supabase.in wss://*.supabase.co `,
          //     "font-src 'self' data:",
          //     "frame-ancestors 'none'",
          //   ].join("; "),
          // },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://maps.gstatic.com",
              "connect-src 'self' http://localhost:54321 ws://localhost:54321 https://*.supabase.co https://*.supabase.in wss://*.supabase.co",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // API-specific caching headers
      {
        source: "/api/analytics/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=30, stale-while-revalidate=60",
          },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // Enable logging in development
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
};

export default nextConfig;
