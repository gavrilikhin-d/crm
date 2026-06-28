import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { LessonType, PaymentMethod, RecurringDeleteScope, Reminder } from "@crm/shared";
import { store } from "./store";

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  match: RegExpMatchArray
) => Promise<void> | void;

const port = Number(process.env.PORT ?? 4000);

const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  route("GET", /^\/api\/health$/, async (_request, response) => jsonOk(response, { ok: true })),
  route("GET", /^\/api\/snapshot$/, getSnapshot),
  route("GET", /^\/api\/dashboard$/, async (_request, response) => jsonOk(response, await store.getDashboard())),
  route("GET", /^\/api\/balances$/, async (_request, response) => jsonOk(response, await store.getBalances())),

  route("POST", /^\/api\/students$/, createStudent),
  route("PATCH", /^\/api\/students\/([^/]+)$/, updateStudent),
  route("DELETE", /^\/api\/students\/([^/]+)$/, deleteStudent),

  route("POST", /^\/api\/lesson-packages$/, createLessonPackage),
  route("DELETE", /^\/api\/lesson-packages\/([^/]+)$/, deleteLessonPackage),

  route("POST", /^\/api\/lessons$/, createLesson),
  route("DELETE", /^\/api\/lessons\/([^/]+)$/, deleteLesson),
  route("POST", /^\/api\/lessons\/([^/]+)\/cancel$/, cancelLesson),
  route("POST", /^\/api\/lessons\/([^/]+)\/complete$/, completeLesson),
  route("POST", /^\/api\/lessons\/([^/]+)\/participants\/([^/]+)\/status$/, setParticipantStatus),

  route("POST", /^\/api\/payments$/, createPayment),
  route("POST", /^\/api\/balance-adjustments$/, createAdjustment),

  route("POST", /^\/internal\/telegram\/bind$/, bindTelegram),
  route("POST", /^\/internal\/reminders$/, upsertReminder),
  route("PATCH", /^\/internal\/reminders\/([^/]+)$/, updateReminder)
];

void startServer().catch((error) => {
  console.error("Backend API failed to start:", error);
  process.exitCode = 1;
});

async function startServer() {
  await store.load();

  createServer(async (request, response) => {
    try {
      setCorsHeaders(response);

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const route = routes.find((candidate) => candidate.method === request.method && url.pathname.match(candidate.pattern));

      if (!route) {
        jsonError(response, new Error("Route not found"), 404);
        return;
      }

      const match = url.pathname.match(route.pattern);
      await route.handler(request, response, match as RegExpMatchArray);
    } catch (error) {
      jsonError(response, error);
    }
  }).listen(port, () => {
    console.log(`Backend API listening on ${port}`);
  });
}

function route(method: string, pattern: RegExp, handler: Handler) {
  return { method, pattern, handler };
}

async function getSnapshot(_request: IncomingMessage, response: ServerResponse) {
  const [snapshot, balances, dashboard] = await Promise.all([
    store.getSnapshot(),
    store.getBalances(),
    store.getDashboard()
  ]);
  jsonOk(response, { ...snapshot, balances, dashboard });
}

async function createStudent(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson(request);
  requireFields(body, ["fullName", "phone"]);
  jsonOk(response, await store.createStudent(body as {
    fullName: string;
    phone: string;
    telegramUsername?: string;
    telegramChatId?: string;
    defaultLessonPrice?: number;
  }), 201);
}

async function updateStudent(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  jsonOk(response, await store.updateStudent(match[1], await readJson(request)));
}

async function deleteStudent(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  await store.deleteStudent(match[1]);
  jsonOk(response, { ok: true });
}

async function createLessonPackage(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson(request);
  requireFields(body, ["name", "lessonCount", "price"]);
  jsonOk(response, await store.createLessonPackage(body as { name: string; lessonCount: number; price: number }), 201);
}

async function deleteLessonPackage(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  await store.deleteLessonPackage(match[1]);
  jsonOk(response, { ok: true });
}

async function createLesson(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson(request);
  requireFields(body, ["startsAt", "lessonType", "studentIds"]);
  jsonOk(response, await store.createLesson(body as {
    startsAt: string;
    durationMinutes?: number;
    lessonType: LessonType;
    studentIds: string[];
    repeatWeekly?: boolean;
  }), 201);
}

async function deleteLesson(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const scope = parseRecurringDeleteScope(url.searchParams.get("scope"));
  await store.deleteLesson(match[1], scope);
  jsonOk(response, { ok: true });
}

function parseRecurringDeleteScope(value: string | null): RecurringDeleteScope {
  if (value === "following" || value === "all") {
    return value;
  }
  return "single";
}

async function cancelLesson(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  jsonOk(response, await store.cancelLesson(match[1]));
}

async function completeLesson(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  jsonOk(response, await store.completeLesson(match[1]));
}

async function setParticipantStatus(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  const body = await readJson(request);
  requireFields(body, ["status"]);
  jsonOk(response, await store.setParticipantStatus(match[1], match[2], body.status, body.action));
}

async function createPayment(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson(request);
  requireFields(body, ["studentId", "method"]);
  jsonOk(response, await store.createPayment(body as {
    studentId: string;
    amount?: number;
    paidAt?: string;
    method: PaymentMethod;
    packageId?: string;
    lessonCount?: number;
  }), 201);
}

async function createAdjustment(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson(request);
  requireFields(body, ["studentId", "lessonDelta", "reason"]);
  jsonOk(response, await store.createAdjustment(body as { studentId: string; lessonDelta: number; reason: string }), 201);
}

async function bindTelegram(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson(request);
  requireFields(body, ["token", "chatId"]);
  jsonOk(response, await store.bindTelegramChat(String(body.token), String(body.chatId), stringValue(body.username)));
}

async function upsertReminder(request: IncomingMessage, response: ServerResponse) {
  jsonOk(response, await store.upsertReminder(await readJson(request) as Omit<Reminder, "id" | "createdAt">), 201);
}

async function updateReminder(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  jsonOk(response, await store.updateReminder(match[1], await readJson(request)));
}

async function readJson(request: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, any>;
}

function jsonOk(response: ServerResponse, payload: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function jsonError(response: ServerResponse, error: unknown, status?: number) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  response.writeHead(status ?? (message.includes("not found") ? 404 : 400), { "content-type": "application/json" });
  response.end(JSON.stringify({ error: message }));
}

function requireFields(body: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
