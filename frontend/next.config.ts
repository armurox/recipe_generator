import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Acknowledge webpack config from @serwist/next so Turbopack dev server doesn't error
  turbopack: {},
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

export default withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
