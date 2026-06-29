import "dotenv/config";
import { readFile } from "node:fs/promises";
import { nanoid } from "nanoid";
import type { Database } from "@crm/shared";
import { db } from "./db/client";
import { accounts } from "./db/schema";
import {
  ensureAccountDefaults,
  insertBalanceAdjustment,
  insertLessonPackage,
  insertLessons,
  insertPayment,
  insertRecurringSchedule,
  insertReminder,
  insertStudent,
  insertTelegramInteraction,
  updateAppSettings
} from "./db/repository";

const dataFilePath = process.env.DATA_FILE_PATH ?? "backend/data/db.json";
const raw = await readFile(dataFilePath, "utf8");
const snapshot = JSON.parse(raw) as Database;

const accountId = nanoid();
const timestamp = new Date().toISOString();

await db.insert(accounts).values({
  id: accountId,
  email: "legacy@local.crm",
  name: "Legacy Import",
  image: null,
  googleSub: `legacy-import-${accountId}`,
  plan: "standard",
  createdAt: timestamp,
  updatedAt: timestamp
});

await ensureAccountDefaults(accountId);
await updateAppSettings(accountId, snapshot.settings);

for (const student of snapshot.students) {
  await insertStudent(accountId, student);
}

for (const lessonPackage of snapshot.lessonPackages) {
  await insertLessonPackage(accountId, lessonPackage);
}

for (const schedule of snapshot.recurringSchedules) {
  await insertRecurringSchedule(accountId, schedule);
}

if (snapshot.lessons.length) {
  await insertLessons(accountId, snapshot.lessons);
}

for (const payment of snapshot.payments) {
  await insertPayment(accountId, payment);
}

for (const adjustment of snapshot.balanceAdjustments) {
  await insertBalanceAdjustment(accountId, adjustment);
}

for (const reminder of snapshot.reminders) {
  await insertReminder(accountId, reminder);
}

for (const interaction of snapshot.telegramInteractions) {
  await insertTelegramInteraction(accountId, interaction);
}

console.log(`Imported legacy JSON into account ${accountId}`);
