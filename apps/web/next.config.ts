import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Development listing images are served by the local Nest API. Keep
    // private-IP optimization disabled in production to preserve SSRF protection.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    // Placeholder listing photos in mock data only — swap for the R2 asset
    // domain once the media module (SRS §8.1) is wired up.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001",
        pathname: "/api/storage/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Next's image optimizer only serves qualities in this allow-list;
    // 90 is used for the splash hero photos (SRS perf budget keeps 75 as
    // the default everywhere else).
    qualities: [75, 90, 100],
  },
};

export default nextConfig;
