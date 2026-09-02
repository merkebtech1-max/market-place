import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
