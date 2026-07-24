import { existsSync } from "node:fs";
import { connect } from "node:net";
import { resolve } from "node:path";

type Profile = "dev" | "frontend" | "backend" | "bot" | "reminder";

type EnvSpec = {
  key: string;
  hint: string;
};

const rootDir = resolve(import.meta.dir, "..");
const envFile = resolve(rootDir, ".env");
const exampleFile = resolve(rootDir, ".env.example");
const sentryHints = {
  NEXT_PUBLIC_SENTRY_DSN: "browser DSN from Sentry project settings",
  SENTRY_DSN: "Next.js server DSN from Sentry project settings",
  BACKEND_SENTRY_DSN: "backend API DSN from Sentry project settings",
  BOT_SENTRY_DSN: "Telegram bot DSN from Sentry project settings",
  REMINDER_SENTRY_DSN: "reminder service DSN from Sentry project settings"
} satisfies Record<string, string>;

const profiles: Record<
  Profile,
  { required: EnvSpec[]; recommended?: EnvSpec[]; checkPostgres?: boolean }
> = {
  dev: {
    required: [
      { key: "DATABASE_URL", hint: "postgres://crm:crm@localhost:5432/crm" },
      { key: "AUTH_SECRET", hint: "generate with: openssl rand -base64 32" },
      { key: "AUTH_GOOGLE_ID", hint: "Google Cloud OAuth client ID" },
      { key: "AUTH_GOOGLE_SECRET", hint: "Google Cloud OAuth client secret" },
      { key: "INTERNAL_API_TOKEN", hint: "generate with: openssl rand -base64 32" }
    ],
    recommended: [
      { key: "AUTH_URL", hint: "http://localhost:3000" },
      { key: "AUTH_SYNC_SECRET", hint: "optional; falls back to AUTH_SECRET" },
      { key: "BACKEND_INTERNAL_URL", hint: "http://localhost:4000" },
      { key: "REMINDER_INTERNAL_URL", hint: "http://localhost:4001" },
      { key: "NEXT_PUBLIC_SENTRY_DSN", hint: sentryHints.NEXT_PUBLIC_SENTRY_DSN },
      { key: "SENTRY_DSN", hint: sentryHints.SENTRY_DSN },
      { key: "BACKEND_SENTRY_DSN", hint: sentryHints.BACKEND_SENTRY_DSN },
      { key: "BOT_SENTRY_DSN", hint: sentryHints.BOT_SENTRY_DSN },
      { key: "REMINDER_SENTRY_DSN", hint: sentryHints.REMINDER_SENTRY_DSN },
      { key: "TELEGRAM_DEV_BOT_TOKEN", hint: "optional; local test bot token for bun dev:all" },
      {
        key: "TELEGRAM_DEV_WEBHOOK_BASE_URL",
        hint: "optional for bun dev:all (auto-started ngrok); required for bun run dev:bot alone"
      },
      { key: "TELEGRAM_DEV_WEBHOOK_SECRET", hint: "required when TELEGRAM_DEV_BOT_TOKEN is set" }
    ],
    checkPostgres: true
  },
  frontend: {
    required: [
      { key: "AUTH_SECRET", hint: "generate with: openssl rand -base64 32" },
      { key: "AUTH_GOOGLE_ID", hint: "Google Cloud OAuth client ID" },
      { key: "AUTH_GOOGLE_SECRET", hint: "Google Cloud OAuth client secret" }
    ],
    recommended: [
      { key: "AUTH_URL", hint: "http://localhost:3000" },
      { key: "NEXT_PUBLIC_SENTRY_DSN", hint: sentryHints.NEXT_PUBLIC_SENTRY_DSN },
      { key: "SENTRY_DSN", hint: sentryHints.SENTRY_DSN }
    ]
  },
  backend: {
    required: [
      { key: "DATABASE_URL", hint: "postgres://crm:crm@localhost:5432/crm" },
      { key: "AUTH_SECRET", hint: "generate with: openssl rand -base64 32" },
      { key: "INTERNAL_API_TOKEN", hint: "generate with: openssl rand -base64 32" }
    ],
    recommended: [
      { key: "BACKEND_SENTRY_DSN", hint: sentryHints.BACKEND_SENTRY_DSN },
      { key: "S3_BUCKET", hint: "S3 bucket for student avatars" },
      { key: "AWS_REGION", hint: "eu-central-1" },
      { key: "S3_ENDPOINT", hint: "optional; http://localhost:9000 for local MinIO" }
    ],
    checkPostgres: true
  },
  bot: {
    required: [{ key: "INTERNAL_API_TOKEN", hint: "generate with: openssl rand -base64 32" }],
    recommended: [
      { key: "BOT_SENTRY_DSN", hint: sentryHints.BOT_SENTRY_DSN },
      { key: "TELEGRAM_BOT_TOKEN", hint: "optional; bot skips Telegram without it" },
      { key: "TELEGRAM_DEV_BOT_TOKEN", hint: "optional; local test bot token" },
      {
        key: "TELEGRAM_DEV_WEBHOOK_BASE_URL",
        hint: "required when TELEGRAM_DEV_BOT_TOKEN is set (or use bun run dev:all to auto-start ngrok)"
      },
      { key: "TELEGRAM_DEV_WEBHOOK_SECRET", hint: "required when TELEGRAM_DEV_BOT_TOKEN is set" },
      { key: "TELEGRAM_WEBHOOK_BASE_URL", hint: "required when TELEGRAM_BOT_TOKEN is set" },
      { key: "TELEGRAM_WEBHOOK_SECRET", hint: "required when TELEGRAM_BOT_TOKEN is set" }
    ]
  },
  reminder: {
    required: [{ key: "INTERNAL_API_TOKEN", hint: "generate with: openssl rand -base64 32" }],
    recommended: [
      { key: "REMINDER_SENTRY_DSN", hint: sentryHints.REMINDER_SENTRY_DSN },
      { key: "TELEGRAM_BOT_TOKEN", hint: "optional; reminders skip Telegram without it" },
      { key: "TELEGRAM_DEV_BOT_TOKEN", hint: "optional; local test bot token" }
    ]
  }
};

function readEnv(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function isSet(key: string): boolean {
  return readEnv(key).length > 0;
}

function parsePostgresTarget(databaseUrl: string): { host: string; port: number } | null {
  try {
    const url = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://"));
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432
    };
  } catch {
    return null;
  }
}

function canConnect(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });

    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function printHelp() {
  console.log(`Usage: bun scripts/check-env.ts <profile>

Profiles:
  dev        full local stack (bun dev:all)
  frontend   Next.js app only
  backend    API server only
  bot        Telegram bot only
  reminder   reminder service only
`);
}

async function main() {
  const profile = (process.argv[2] ?? "dev") as Profile;
  const spec = profiles[profile];

  if (!spec) {
    printHelp();
    process.exit(1);
  }

  if (!existsSync(envFile)) {
    console.error("Missing .env file.\n");
    console.error(`Create one from the template:\n  cp .env.example .env`);
    process.exit(1);
  }

  let missing = spec.required.filter(({ key }) => !isSet(key));
  if ((profile === "dev" || profile === "bot") && (isSet("TELEGRAM_DEV_BOT_TOKEN") || isSet("TELEGRAM_BOT_TOKEN"))) {
    const webhookEnv = isSet("TELEGRAM_DEV_BOT_TOKEN")
      ? [
          // bun dev:all starts ngrok and injects TELEGRAM_DEV_WEBHOOK_BASE_URL.
          ...(profile === "bot"
            ? [
                {
                  key: "TELEGRAM_DEV_WEBHOOK_BASE_URL",
                  hint: "public HTTPS tunnel origin, e.g. https://example.ngrok-free.app (or use bun run dev:all)"
                }
              ]
            : []),
          { key: "TELEGRAM_DEV_WEBHOOK_SECRET", hint: "generate a URL-safe random value for local dev" }
        ]
      : [
          { key: "TELEGRAM_WEBHOOK_BASE_URL", hint: "public HTTPS ingress origin, e.g. https://vocalcrm.site" },
          { key: "TELEGRAM_WEBHOOK_SECRET", hint: "generate a URL-safe random value" }
        ];
    missing = [
      ...missing,
      ...webhookEnv.filter(({ key }) => !isSet(key))
    ];
  }
  let emptyRecommended = spec.recommended?.filter(({ key }) => !isSet(key)) ?? [];
  if ((profile === "bot" || profile === "reminder") && isSet("TELEGRAM_DEV_BOT_TOKEN")) {
    emptyRecommended = emptyRecommended.filter(({ key }) => !key.startsWith("TELEGRAM_BOT") && !key.startsWith("TELEGRAM_WEBHOOK"));
  }
  if ((profile === "bot" || profile === "reminder") && isSet("TELEGRAM_BOT_TOKEN")) {
    emptyRecommended = emptyRecommended.filter(({ key }) => !key.startsWith("TELEGRAM_DEV"));
  }

  if (missing.length > 0) {
    console.error(`Missing required environment variables for "${profile}":\n`);
    for (const { key, hint } of missing) {
      console.error(`  ${key}`);
      console.error(`    ${hint}\n`);
    }
    console.error(`Add them to .env (see ${exampleFile}).`);
    process.exit(1);
  }

  if (emptyRecommended.length > 0) {
    console.warn(`Optional variables not set for "${profile}":`);
    for (const { key, hint } of emptyRecommended) {
      console.warn(`  ${key} — ${hint}`);
    }
    console.warn("");
  }

  if (spec.checkPostgres) {
    const databaseUrl = readEnv("DATABASE_URL");
    const target = parsePostgresTarget(databaseUrl);

    if (!target) {
      console.error(`DATABASE_URL is invalid: ${databaseUrl}`);
      process.exit(1);
    }

    const reachable = await canConnect(target.host, target.port);
    if (!reachable) {
      console.error("PostgreSQL is not reachable.\n");
      console.error(`  DATABASE_URL=${databaseUrl}`);
      console.error(`  Expected host: ${target.host}:${target.port}\n`);
      console.error("Start Postgres before running the app:\n  docker compose up -d postgres");
      process.exit(1);
    }
  }

  console.log(`Environment OK (${profile}).`);
}

await main();
