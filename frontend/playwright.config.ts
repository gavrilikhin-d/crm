import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const backendURL = process.env.E2E_BACKEND_URL ?? "http://localhost:4100";
const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgres://crm:crm@localhost:55432/crm_e2e";
const authSecret = process.env.E2E_AUTH_SECRET ?? "e2e-auth-secret-for-local-oidc-tests";
const internalApiToken = process.env.E2E_INTERNAL_API_TOKEN ?? "e2e-internal-api-token";
const oidcIssuer = process.env.AUTH_E2E_OIDC_ISSUER ?? "http://localhost:5556/dex";
const oidcClientId = process.env.AUTH_E2E_OIDC_ID ?? "crm-e2e";
const oidcClientSecret = process.env.AUTH_E2E_OIDC_SECRET ?? "crm-e2e-secret";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: `cd .. && ${withEnv({
        PORT: new URL(backendURL).port || "4100",
        DATABASE_URL: databaseUrl,
        AUTH_SECRET: authSecret,
        AUTH_SYNC_SECRET: authSecret,
        E2E_AUTH: "1",
        INTERNAL_API_TOKEN: internalApiToken
      })} bun --filter @crm/backend dev`,
      url: `${backendURL}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false
    },
    {
      command: `${withEnv({
        PORT: new URL(baseURL).port || "3100",
        AUTH_URL: baseURL,
        AUTH_SECRET: authSecret,
        AUTH_SYNC_SECRET: authSecret,
        AUTH_GOOGLE_ID: "e2e-unused-google-client",
        AUTH_GOOGLE_SECRET: "e2e-unused-google-secret",
        BACKEND_INTERNAL_URL: backendURL,
        E2E_AUTH: "1",
        NEXT_PUBLIC_E2E_AUTH: "1",
        NEXT_PUBLIC_LOCALE: "en",
        AUTH_E2E_OIDC_ISSUER: oidcIssuer,
        AUTH_E2E_OIDC_ID: oidcClientId,
        AUTH_E2E_OIDC_SECRET: oidcClientSecret,
        NEXT_PUBLIC_BACKEND_WS_URL: `${backendURL.replace(/^http/, "ws")}/api/ws/snapshot`
      })} bun run dev`,
      url: `${baseURL}/login`,
      timeout: 120_000,
      reuseExistingServer: false
    }
  ]
});

function withEnv(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
