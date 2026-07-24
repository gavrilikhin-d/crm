import type { Subprocess } from "bun";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const botPort = Number(process.env.BOT_PORT ?? 4002) || 4002;
const ngrokApi = "http://127.0.0.1:4040/api/tunnels";

type NgrokTunnelsResponse = {
  tunnels?: Array<{ public_url?: string; config?: { addr?: string } }>;
};

const children: Subprocess[] = [];
let shuttingDown = false;

async function main(): Promise<void> {
  const env = { ...process.env };
  const hasDevBot = Boolean(env.TELEGRAM_DEV_BOT_TOKEN?.trim());

  if (hasDevBot) {
    const { url, child } = await ensureNgrok(botPort);
    if (child) {
      children.push(child);
    }
    env.TELEGRAM_DEV_WEBHOOK_BASE_URL = url;
    console.log(`[dev:all] TELEGRAM_DEV_WEBHOOK_BASE_URL=${url}`);
  } else {
    console.log("[dev:all] TELEGRAM_DEV_BOT_TOKEN unset; skipping ngrok");
  }

  spawnService("backend", ["bun", "--filter", "@crm/backend", "dev"], { ...env, PORT: "4000" });
  spawnService("frontend", ["bun", "--filter", "@crm/frontend", "dev"], { ...env, PORT: "3000" });
  spawnService("bot", ["bun", "--filter", "@crm/bot", "dev"], env);
  spawnService("reminder", ["bun", "--filter", "@crm/reminder", "dev"], { ...env, REMINDER_PORT: "4001" });

  const exitCodes = await Promise.all(children.map((child) => child.exited));
  if (!shuttingDown) {
    const failed = exitCodes.find((code) => code !== 0);
    process.exit(failed ?? 0);
  }
}

function spawnService(name: string, cmd: string[], env: NodeJS.ProcessEnv): void {
  console.log(`[dev:all] starting ${name}`);
  const child = Bun.spawn(cmd, {
    cwd: rootDir,
    env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit"
  });
  children.push(child);
}

async function ensureNgrok(port: number): Promise<{ url: string; child?: Subprocess }> {
  const existing = await fetchNgrokHttpsUrl(port);
  if (existing) {
    console.log(`[dev:all] reusing existing ngrok tunnel: ${existing}`);
    return { url: existing };
  }

  if (!Bun.which("ngrok")) {
    throw new Error(
      "ngrok is not installed or not on PATH. Install it (https://ngrok.com/download), then retry `bun run dev:all`."
    );
  }

  console.log(`[dev:all] starting ngrok http ${port}`);
  const child = Bun.spawn(["ngrok", "http", String(port)], {
    cwd: rootDir,
    stdout: "ignore",
    stderr: "inherit",
    stdin: "ignore"
  });

  try {
    const url = await waitForNgrokHttpsUrl(port, child);
    return { url, child };
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function waitForNgrokHttpsUrl(port: number, child: Subprocess, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`ngrok exited early with code ${child.exitCode}`);
    }
    const url = await fetchNgrokHttpsUrl(port);
    if (url) {
      return url;
    }
    await Bun.sleep(200);
  }

  throw new Error(`Timed out waiting for ngrok HTTPS URL on port ${port} (API ${ngrokApi}).`);
}

async function fetchNgrokHttpsUrl(port: number): Promise<string | null> {
  try {
    const response = await fetch(ngrokApi);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as NgrokTunnelsResponse;
    const tunnels = payload.tunnels ?? [];
    const matching = tunnels.find((tunnel) => {
      if (!tunnel.public_url?.startsWith("https://")) {
        return false;
      }
      const addr = tunnel.config?.addr ?? "";
      return addr.includes(`:${port}`) || addr.endsWith(String(port)) || addr === `http://localhost:${port}`;
    });
    const https = matching ?? tunnels.find((tunnel) => tunnel.public_url?.startsWith("https://"));
    return https?.public_url?.replace(/\/+$/, "") ?? null;
  } catch {
    return null;
  }
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[dev:all] received ${signal}; stopping children`);
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // already exited
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  await main();
} catch (error) {
  console.error(`[dev:all] ${error instanceof Error ? error.message : String(error)}`);
  shutdown("SIGTERM");
  process.exit(1);
}
