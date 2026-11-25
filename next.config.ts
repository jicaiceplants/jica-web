import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel Hobby Free-Tier Protection: never consume paid Next.js Image Optimization quota
  images: {
    unoptimized: true
  }
};

export default nextConfig;
