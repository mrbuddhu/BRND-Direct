import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static legacy site lives in /public — same paths as before (/buyer/*.html, /css/*, …).
  // Skip caching HTML in prod so updates show immediately (optional; aligns with old _headers intent).
  async headers() {
    return [
      {
        source: "/:path*.html",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
