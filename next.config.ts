import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 减小 bundle 体积
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // 优化包导入
  experimental: {
    optimizePackageImports: ["lucide-react", "dayjs", "zod"],
  },
};

export default nextConfig;
