import "dotenv/config";
import { createServer } from "node:http";
import { sendManualPaymentReminder, startReminderScheduler } from "./reminders";

const port = Number(process.env.PORT ?? 4001);

startReminderScheduler();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const match = url.pathname.match(/^\/api\/payment-reminders\/([^/]+)$/);

    if (request.method === "GET" && url.pathname === "/health") {
      jsonOk(response, { ok: true });
      return;
    }

    if (request.method !== "POST" || !match) {
      jsonError(response, new Error("Route not found"), 404);
      return;
    }

    const result = await sendManualPaymentReminder(match[1]);
    jsonOk(response, { ok: true, ...result }, 202);
  } catch (error) {
    jsonError(response, error);
  }
}).listen(port, () => {
  console.log(`Reminder service listening on ${port}`);
});

function jsonOk(response: import("node:http").ServerResponse, payload: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function jsonError(response: import("node:http").ServerResponse, error: unknown, status?: number) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  response.writeHead(status ?? (message.includes("not found") ? 404 : 400), { "content-type": "application/json" });
  response.end(JSON.stringify({ error: message }));
}
