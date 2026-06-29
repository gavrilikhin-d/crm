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
      { key: "REMINDER_INTERNAL_URL", hint: "http://localhost:4001" }
    ],
    checkPostgres: true
  },
  frontend: {
    required: [
      { key: "AUTH_SECRET", hint: "generate with: openssl rand -base64 32" },
      { key: "AUTH_GOOGLE_ID", hint: "Google Cloud OAuth client ID" },
      { key: "AUTH_GOOGLE_SECRET", hint: "Google Cloud OAuth client secret" }
    ],
    recommended: [{ key: "AUTH_URL", hint: "http://localhost:3000" }]
  },
  backend: {
    required: [
      { key: "DATABASE_URL", hint: "postgres://crm:crm@localhost:5432/crm" },
      { key: "AUTH_SECRET", hint: "generate with: openssl rand -base64 32" },
      { key: "INTERNAL_API_TOKEN", hint: "generate with: openssl rand -base64 32" }
    ],
    checkPostgres: true
  },
  bot: {
    required: [{ key: "INTERNAL_API_TOKEN", hint: "generate with: openssl rand -base64 32" }],
    recommended: [{ key: "TELEGRAM_BOT_TOKEN", hint: "optional; bot skips Telegram without it" }]
  },
  reminder: {
    required: [{ key: "INTERNAL_API_TOKEN", hint: "generate with: openssl rand -base64 32" }],
    recommended: [{ key: "TELEGRAM_BOT_TOKEN", hint: "optional; reminders skip Telegram without it" }]
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

  const missing = spec.required.filter(({ key }) => !isSet(key));
  const emptyRecommended = spec.recommended?.filter(({ key }) => !isSet(key)) ?? [];

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
