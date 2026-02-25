import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.spoonacular.com",
      },
      {
        protocol: "https",
        hostname: "jyubxcugxmtdsemfjucq.supabase.co",
      },
    ],
  },
};

export default nextConfig;
