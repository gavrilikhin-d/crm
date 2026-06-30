import "./load-env.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { LessonType, PaymentMethod, RecurringDeleteScope, Reminder } from "@crm/shared";
import {
  assertAuthSyncSecret,
  assertInternalToken,
  authenticateRequest,
  type AuthContext
} from "./auth";
import { getAccountById, getLessonAccountId, getReminderAccountId, listAccountIds } from "./db/repository";
import { PlanLimitError, store } from "./store";
import { verifyGoogleCalendarOAuthState } from "./google-calendar/oauth-state";

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  match: RegExpMatchArray,
  ctx?: AuthContext
) => Promise<void> | void;

const port = Number(process.env.PORT ?? 4000);

const publicRoutes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  route("GET", /^\/api\/health$/, async (_request, response) => jsonOk(response, { ok: true })),
  route("POST", /^\/api\/auth\/sync$/, syncAccount),
  route("GET", /^\/api\/google-calendar\/callback$/, googleCalendarCallback)
];

const protectedRoutes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  route("GET", /^\/api\/account$/, getAccount),
  route("GET", /^\/api\/snapshot$/, getSnapshot),
  route("GET", /^\/api\/dashboard$/, async (_request, response, _match, ctx) =>
    jsonOk(response, await store.getDashboard(ctx!))
  ),
  route("GET", /^\/api\/balances$/, async (_request, response, _match, ctx) =>
    jsonOk(response, await store.getBalances(ctx!))
  ),

  route("PATCH", /^\/api\/settings$/, updateSettings),

  route("GET", /^\/api\/google-calendar\/status$/, getGoogleCalendarStatus),
  route("GET", /^\/api\/google-calendar\/connect$/, getGoogleCalendarConnect),
  route("POST", /^\/api\/google-calendar\/sync$/, syncGoogleCalendar),
  route("DELETE", /^\/api\/google-calendar\/disconnect$/, disconnectGoogleCalendar),

  route("GET", /^\/api\/students\/([^/]+)\/avatar$/, getStudentAvatar),
  route("POST", /^\/api\/students$/, createStudent),
  route("PATCH", /^\/api\/students\/([^/]+)$/, updateStudent),
  route("DELETE", /^\/api\/students\/([^/]+)$/, deleteStudent),

  route("POST", /^\/api\/lesson-packages$/, createLessonPackage),
  route("DELETE", /^\/api\/lesson-packages\/([^/]+)$/, deleteLessonPackage),

  route("POST", /^\/api\/lessons$/, createLesson),
  route("DELETE", /^\/api\/lessons\/([^/]+)$/, deleteLesson),
  route("POST", /^\/api\/lessons\/([^/]+)\/cancel$/, cancelLesson),
  route("POST", /^\/api\/lessons\/([^/]+)\/complete$/, completeLesson),
  route("DELETE", /^\/api\/lessons\/([^/]+)\/participants\/([^/]+)$/, removeLessonParticipant),
  route("POST", /^\/api\/lessons\/([^/]+)\/participants$/, addLessonParticipant),
  route("POST", /^\/api\/lessons\/([^/]+)\/participants\/([^/]+)\/status$/, setParticipantStatus),

  route("POST", /^\/api\/payments$/, createPayment),
  route("POST", /^\/api\/balance-adjustments$/, createAdjustment)
];

const internalRoutes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  route("GET", /^\/internal\/worker\/snapshots$/, getWorkerSnapshots),
  route("POST", /^\/internal\/lessons\/([^/]+)\/participants\/([^/]+)\/status$/, setParticipantStatusInternal),
  route("POST", /^\/internal\/telegram\/bind$/, bindTelegram),
  route("GET", /^\/internal\/telegram\/profile$/, getTelegramProfile),
  route("POST", /^\/internal\/reminders$/, upsertReminder),
  route("PATCH", /^\/internal\/reminders\/([^/]+)$/, updateReminder)
];

void startServer().catch((error) => {
  console.error("Backend API failed to start:", error);
  process.exitCode = 1;
});

async function startServer() {
  await store.initialize();

  createServer(async (request, response) => {
    try {
      setCorsHeaders(request, response);

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      const publicRoute = publicRoutes.find(
        (candidate) => candidate.method === request.method && url.pathname.match(candidate.pattern)
      );
      if (publicRoute) {
        const match = url.pathname.match(publicRoute.pattern);
        await publicRoute.handler(request, response, match as RegExpMatchArray);
        return;
      }

      const internalRoute = internalRoutes.find(
        (candidate) => candidate.method === request.method && url.pathname.match(candidate.pattern)
      );
      if (internalRoute) {
        assertInternalToken(request);
        const match = url.pathname.match(internalRoute.pattern);
        await internalRoute.handler(request, response, match as RegExpMatchArray);
        return;
      }

      const protectedRoute = protectedRoutes.find(
        (candidate) => candidate.method === request.method && url.pathname.match(candidate.pattern)
      );
      if (!protectedRoute) {
        jsonError(response, new Error("Route not found"), 404);
        return;
      }

      const ctx = await authenticateRequest(request);
      const match = url.pathname.match(protectedRoute.pattern);
      await protectedRoute.handler(request, response, match as RegExpMatchArray, ctx);
    } catch (error) {
      if (error instanceof PlanLimitError) {
        jsonError(response, error, 403, { code: error.code });
        return;
      }
      const message = error instanceof Error ? error.message : "Unexpected error";
      if (message === "Unauthorized" || message === "Invalid token payload") {
        jsonError(response, error, 401);
        return;
      }
      jsonError(response, error);
    }
  }).listen(port, () => {
    console.log(`Backend API listening on ${port}`);
  });
}

function route(method: string, pattern: RegExp, handler: Handler) {
  return { method, pattern, handler };
}

async function syncAccount(request: IncomingMessage, response: ServerResponse) {
  assertAuthSyncSecret(request);
  const body = await readJson(request);
  requireFields(body, ["googleSub", "email", "name"]);
  jsonOk(
    response,
    await store.syncAccount({
      googleSub: String(body.googleSub),
      email: String(body.email),
      name: String(body.name),
      image: stringValue(body.image)
    })
  );
}

async function getAccount(_request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, await store.getAccountInfo(ctx!));
}

async function getSnapshot(_request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  const [snapshot, balances, dashboard, accountInfo] = await Promise.all([
    store.getSnapshot(ctx!),
    store.getBalances(ctx!),
    store.getDashboard(ctx!),
    store.getAccountInfo(ctx!)
  ]);
  jsonOk(response, { ...snapshot, balances, dashboard, account: accountInfo });
}

async function getStudentAvatar(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  const avatar = await store.getStudentAvatar(ctx!, match[1]);
  if (!avatar) {
    jsonError(response, new Error("Avatar not found"), 404);
    return;
  }

  response.writeHead(200, { "content-type": avatar.mime, "cache-control": "no-cache" });
  response.end(avatar.buffer);
}

async function updateSettings(request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, await store.updateSettings(ctx!, await readJson(request)));
}

async function getGoogleCalendarStatus(_request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, await store.getGoogleCalendarStatus(ctx!));
}

async function getGoogleCalendarConnect(_request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, { url: await store.getGoogleCalendarConnectUrl(ctx!) });
}

async function syncGoogleCalendar(_request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, await store.syncGoogleCalendar(ctx!));
}

async function disconnectGoogleCalendar(_request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  await store.disconnectGoogleCalendar(ctx!);
  jsonOk(response, { ok: true });
}

async function googleCalendarCallback(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const appBaseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  const settingsUrl = `${appBaseUrl.replace(/\/$/, "")}/?section=settings`;

  if (error || !code || !state) {
    redirect(response, `${settingsUrl}&calendar=error`);
    return;
  }

  try {
    const accountId = await verifyGoogleCalendarOAuthState(state);
    await store.completeGoogleCalendarConnect(accountId, code);
    redirect(response, `${settingsUrl}&calendar=connected`);
  } catch (callbackError) {
    console.error("[google-calendar] OAuth callback failed", callbackError);
    redirect(response, `${settingsUrl}&calendar=error`);
  }
}

async function createStudent(request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  const body = await readJson(request);
  requireFields(body, ["fullName"]);
  jsonOk(
    response,
    await store.createStudent(ctx!, body as {
      fullName: string;
      avatarDataUrl?: string;
      telegramUsername?: string;
      telegramChatId?: string;
      defaultLessonPrice?: number;
    }),
    201
  );
}

async function updateStudent(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, await store.updateStudent(ctx!, match[1], await readJson(request)));
}

async function deleteStudent(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  await store.deleteStudent(ctx!, match[1]);
  jsonOk(response, { ok: true });
}

async function createLessonPackage(request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  const body = await readJson(request);
  requireFields(body, ["name", "lessonCount", "price"]);
  jsonOk(
    response,
    await store.createLessonPackage(ctx!, body as { name: string; lessonCount: number; price: number }),
    201
  );
}

async function deleteLessonPackage(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  await store.deleteLessonPackage(ctx!, match[1]);
  jsonOk(response, { ok: true });
}

async function createLesson(request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  const body = await readJson(request);
  requireFields(body, ["startsAt", "lessonType", "studentIds"]);
  jsonOk(
    response,
    await store.createLesson(ctx!, body as {
      startsAt: string;
      durationMinutes?: number;
      lessonType: LessonType;
      studentIds: string[];
      repeatWeekly?: boolean;
    }),
    201
  );
}

async function deleteLesson(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const scope = parseRecurringDeleteScope(url.searchParams.get("scope"));
  await store.deleteLesson(ctx!, match[1], scope);
  jsonOk(response, { ok: true });
}

function parseRecurringDeleteScope(value: string | null): RecurringDeleteScope {
  if (value === "following" || value === "all") {
    return value;
  }
  return "single";
}

async function cancelLesson(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, await store.cancelLesson(ctx!, match[1]));
}

async function completeLesson(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  jsonOk(response, await store.completeLesson(ctx!, match[1]));
}

async function removeLessonParticipant(_request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  const lesson = await store.removeLessonParticipant(ctx!, match[1], match[2]);
  jsonOk(response, lesson ?? { ok: true });
}

async function addLessonParticipant(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  const body = await readJson(request) as { studentId?: string; studentIds?: string[] };
  const studentIds = body.studentIds?.length
    ? body.studentIds
    : body.studentId
      ? [body.studentId]
      : [];

  if (!studentIds.length) {
    jsonError(response, new Error("studentId or studentIds is required"), 400);
    return;
  }

  jsonOk(response, await store.addLessonParticipants(ctx!, match[1], studentIds), 201);
}

async function setParticipantStatus(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray, ctx?: AuthContext) {
  const body = await readJson(request);
  requireFields(body, ["status"]);
  jsonOk(response, await store.setParticipantStatus(ctx!, match[1], match[2], body.status, body.action));
}

async function createPayment(request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  const body = await readJson(request);
  requireFields(body, ["studentId", "method"]);
  jsonOk(
    response,
    await store.createPayment(ctx!, body as {
      studentId: string;
      amount?: number;
      paidAt?: string;
      method: PaymentMethod;
      packageId?: string;
      lessonCount?: number;
    }),
    201
  );
}

async function createAdjustment(request: IncomingMessage, response: ServerResponse, _match: RegExpMatchArray, ctx?: AuthContext) {
  const body = await readJson(request);
  requireFields(body, ["studentId", "lessonDelta", "reason"]);
  jsonOk(
    response,
    await store.createAdjustment(ctx!, body as { studentId: string; lessonDelta: number; reason: string }),
    201
  );
}

async function getWorkerSnapshots(_request: IncomingMessage, response: ServerResponse) {
  const accountIds = await listAccountIds();
  const snapshots = await Promise.all(
    accountIds.map(async (accountId) => {
      const account = await getAccountById(accountId);
      if (!account) {
        return null;
      }
      const ctx = { accountId, email: account.email, plan: account.plan };
      const snapshot = await store.getSnapshot(ctx);
      const balances = await store.getBalances(ctx);
      return { accountId, snapshot, balances, settings: snapshot.settings };
    })
  );
  jsonOk(response, snapshots.filter(Boolean));
}

async function setParticipantStatusInternal(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  const body = await readJson(request);
  requireFields(body, ["status"]);
  const accountId = await getLessonAccountId(match[1]);
  if (!accountId) {
    jsonError(response, new Error("Lesson not found"), 404);
    return;
  }
  jsonOk(
    response,
    await store.setParticipantStatusForAccount(accountId, match[1], match[2], body.status, body.action)
  );
}

async function bindTelegram(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson(request);
  requireFields(body, ["token", "chatId", "userId"]);
  jsonOk(
    response,
    await store.bindTelegramChat(
      String(body.token),
      String(body.chatId),
      String(body.userId),
      stringValue(body.username)
    )
  );
}

async function getTelegramProfile(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const userId = url.searchParams.get("userId") ?? url.searchParams.get("chatId");
  if (!userId) {
    jsonError(response, new Error("Missing required field: userId"));
    return;
  }

  jsonOk(response, await store.getTelegramStudentProfile(userId, { days: parseScheduleDaysParam(url.searchParams.get("days")) }));
}

function parseScheduleDaysParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
    throw new Error("Schedule days must be an integer between 1 and 90");
  }

  return parsed;
}

async function upsertReminder(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJson(request)) as Omit<Reminder, "id" | "createdAt">;
  const accountId = body.lessonId ? await getLessonAccountId(body.lessonId) : null;
  if (!accountId) {
    throw new Error("Lesson not found");
  }
  jsonOk(response, await store.upsertReminder(accountId, body), 201);
}

async function updateReminder(request: IncomingMessage, response: ServerResponse, match: RegExpMatchArray) {
  const body = await readJson(request);
  const accountId = await getReminderAccountId(match[1]);
  if (!accountId) {
    jsonError(response, new Error("Reminder not found"), 404);
    return;
  }
  jsonOk(response, await store.updateReminder(accountId, match[1], body));
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

function redirect(response: ServerResponse, location: string) {
  response.writeHead(302, { location });
  response.end();
}

function jsonError(response: ServerResponse, error: unknown, status?: number, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  response.writeHead(status ?? (message.includes("not found") ? 404 : 400), { "content-type": "application/json" });
  response.end(JSON.stringify({ error: message, ...extra }));
}

function requireFields(body: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

function setCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  const allowedOrigin = process.env.APP_BASE_URL ?? "http://localhost:3000";
  response.setHeader("access-control-allow-origin", origin === allowedOrigin ? origin : allowedOrigin);
  response.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,authorization");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
