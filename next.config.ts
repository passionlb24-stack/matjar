import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy. Allow-list built from an actual audit of every
// resource the app loads: self, Supabase (images/auth/rest + realtime wss),
// OpenStreetMap tiles (Leaflet map), Vercel Analytics, data:/blob: (QR + story
// canvas + Leaflet marker), self-hosted fonts. Dev also needs 'unsafe-eval'
// and ws: for Turbopack HMR — production stays without them.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org`,
  `font-src 'self' data:`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com https://va.vercel-scripts.com${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Block the site from being framed (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Least-privilege browser features (geolocation stays on for "nearest stores").
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wesihatopiznatsyfxer.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
