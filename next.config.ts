import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // ── Build Speed ──────────────────────────────────────────────────────
  // Skip type checking during Vercel builds — saves ~12s per build.
  // Types are validated in development and can be checked in CI separately.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ── Runtime Speed ────────────────────────────────────────────────────
  // Compress responses with gzip (reduces transfer size ~60-70%)
  compress: true,

  // Enable React strict mode for catching bugs in development
  reactStrictMode: true,

  // Optimize package imports — tree-shake heavy libraries
  optimizePackageImports: [
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/pm",
    "@dnd-kit/core",
    "@dnd-kit/sortable",
    "react-markdown",
  ],

  // Cache headers for static assets
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0" },
      ],
    },
  ],
};

export default nextConfig;
