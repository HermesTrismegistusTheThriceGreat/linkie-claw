import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "media.licdn.com",
      },
      ...(process.env.R2_PUBLIC_URL ? [{
        protocol: "https" as const,
        hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
      }] : []),
    ],
  },
};

export default nextConfig;
