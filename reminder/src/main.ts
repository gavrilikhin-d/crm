import "dotenv/config";
import { initSentryNode } from "@crm/shared/sentry-node";
import { createServer } from "node:http";
import { sendManualPaymentReminder, startReminderScheduler } from "./reminders";
import { waitForBackend } from "./backend-client";
import { log } from "./logger";

initSentryNode("reminder");

const port = Number(process.env.PORT ?? 4001);

void bootstrap();

async function bootstrap(): Promise<void> {
  await waitForBackend();
  startReminderScheduler();

  createServer(async (request, response) => {
    const startedAt = Date.now();
    const method = request.method ?? "GET";
    const path = request.url ?? "/";

    try {
      const url = new URL(path, `http://${request.headers.host ?? "localhost"}`);
      const match = url.pathname.match(/^\/api\/payment-reminders\/([^/]+)$/);

      if (method === "GET" && url.pathname === "/health") {
        jsonOk(response, { ok: true });
        logRequest(method, url.pathname, 200, startedAt);
        return;
      }

      if (method !== "POST" || !match) {
        jsonError(response, new Error("Route not found"), 404);
        logRequest(method, url.pathname, 404, startedAt);
        return;
      }

      const result = await sendManualPaymentReminder(match[1]);
      jsonOk(response, { ok: true, ...result }, 202);
      logRequest(method, url.pathname, 202, startedAt, { studentId: match[1], sent: result.sent });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      const status = message.includes("not found") ? 404 : 400;
      jsonError(response, error, status);
      logRequest(method, path, status, startedAt, { err: error });
    }
  }).listen(port, () => {
    log.info("Reminder service listening", { port });
  });
}

function logRequest(
  method: string,
  path: string,
  status: number,
  startedAt: number,
  context: Record<string, unknown> = {}
): void {
  log.info("HTTP request handled", {
    method,
    path,
    status,
    durationMs: Date.now() - startedAt,
    ...context
  });
}

function jsonOk(response: import("node:http").ServerResponse, payload: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function jsonError(response: import("node:http").ServerResponse, error: unknown, status?: number) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  response.writeHead(status ?? (message.includes("not found") ? 404 : 400), { "content-type": "application/json" });
  response.end(JSON.stringify({ error: message }));
}
