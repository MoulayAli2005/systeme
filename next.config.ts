import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "ioredis", "bullmq", "@prisma/adapter-pg"],
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.cursor.sh", "*.cursor.com"],
};

export default nextConfig;
