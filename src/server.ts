import "dotenv/config";
import cors from "cors";
import express from "express";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sendManualPaymentReminder, startReminderScheduler } from "./reminders.js";
import { store } from "./store.js";
import { startTelegramBot } from "./telegram.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/snapshot", async (_req, res, next) => {
  try {
    const [snapshot, balances, dashboard] = await Promise.all([
      store.getSnapshot(),
      store.getBalances(),
      store.getDashboard()
    ]);
    res.json({ ...snapshot, balances, dashboard });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    res.json(await store.getDashboard());
  } catch (error) {
    next(error);
  }
});

app.post("/api/students", async (req, res, next) => {
  try {
    requireFields(req.body, ["fullName", "phone"]);
    res.status(201).json(await store.createStudent(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/students/:id", async (req, res, next) => {
  try {
    res.json(await store.updateStudent(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lesson-packages", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "lessonCount", "price"]);
    res.status(201).json(await store.createLessonPackage(req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons", async (req, res, next) => {
  try {
    requireFields(req.body, ["startsAt", "lessonType", "studentIds"]);
    res.status(201).json(await store.createLesson(req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons/:id/participants/:studentId/status", async (req, res, next) => {
  try {
    requireFields(req.body, ["status"]);
    res.json(await store.setParticipantStatus(req.params.id, req.params.studentId, req.body.status));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons/:id/complete", async (req, res, next) => {
  try {
    res.json(await store.completeLesson(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons/:id/cancel", async (req, res, next) => {
  try {
    res.json(await store.cancelLesson(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments", async (req, res, next) => {
  try {
    requireFields(req.body, ["studentId", "method"]);
    res.status(201).json(await store.createPayment(req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/balance-adjustments", async (req, res, next) => {
  try {
    requireFields(req.body, ["studentId", "lessonDelta", "reason"]);
    res.status(201).json(await store.createAdjustment(req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/payment-reminders/:studentId", async (req, res, next) => {
  try {
    const result = await sendManualPaymentReminder(req.params.studentId);
    res.status(202).json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("not found") ? 404 : 400;
  res.status(status).json({ error: message });
});

await store.load();
startReminderScheduler();

app.listen(port, () => {
  console.log(`CRM app is running on http://localhost:${port}`);
  void startTelegramBot();
});

function requireFields(body: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}
