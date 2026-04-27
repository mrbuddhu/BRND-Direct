import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support both clean routes and legacy .html routes.
  // Example: /buyer/products -> /buyer/products.html
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      { source: "/index", destination: "/index.html" },
      { source: "/admin", destination: "/admin/index.html" },
      { source: "/buyer", destination: "/buyer/index.html" },
      { source: "/seller", destination: "/seller/index.html" },
      { source: "/investor", destination: "/investor/index.html" },
      { source: "/investor-demo", destination: "/investor-demo/index.html" },
      { source: "/admin/:path((?!.*\\.html$).*)", destination: "/admin/:path.html" },
      { source: "/buyer/:path((?!.*\\.html$).*)", destination: "/buyer/:path.html" },
      { source: "/seller/:path((?!.*\\.html$).*)", destination: "/seller/:path.html" },
      { source: "/investor/:path((?!.*\\.html$).*)", destination: "/investor/:path.html" },
      { source: "/investor-demo/:path((?!.*\\.html$).*)", destination: "/investor-demo/:path.html" },
    ];
  },

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
