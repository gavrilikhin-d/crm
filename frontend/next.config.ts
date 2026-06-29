import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(path.resolve(frontendDir, ".."));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
    const reminderUrl = process.env.REMINDER_INTERNAL_URL ?? "http://localhost:4001";

    return [
      {
        source: "/api/payment-reminders/:path*",
        destination: `${reminderUrl}/api/payment-reminders/:path*`
      },
      // App routes under /api/auth/* take priority; everything else proxies to backend
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
