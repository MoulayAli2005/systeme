import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "ioredis", "bullmq", "@prisma/adapter-pg"],
};

export default nextConfig;
