import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
    const reminderUrl = process.env.REMINDER_INTERNAL_URL ?? "http://localhost:4001";

    return [
      {
        source: "/api/payment-reminders/:path*",
        destination: `${reminderUrl}/api/payment-reminders/:path*`
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
