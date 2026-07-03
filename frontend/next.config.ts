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
  allowedDevOrigins: ["daniil.gavrilikhin.ngrok.dev"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Document-Policy", value: "js-profiling" }]
      }
    ];
  }
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "gavrilikhin-daniil",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: process.env.SENTRY_RELEASE ? { name: process.env.SENTRY_RELEASE } : undefined,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI
});
