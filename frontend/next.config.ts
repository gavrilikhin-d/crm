import { loadEnvConfig } from "@next/env";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(path.resolve(frontendDir, ".."));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Document-Policy", value: "js-profiling" }]
      }
    ];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
    const reminderUrl = process.env.REMINDER_INTERNAL_URL ?? "http://localhost:4001";

    return [
      {
        source: "/api/payment-reminders/:path*",
        destination: `${reminderUrl}/api/payment-reminders/:path*`
      },
      {
        // Exclude /api/auth/* — handled by Next.js (Auth.js route handlers)
        source: "/api/:path((?!auth/|auth$).*)",
        destination: `${backendUrl}/api/:path`
      }
    ];
  }
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "gavrilikhin-daniil",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI
});
