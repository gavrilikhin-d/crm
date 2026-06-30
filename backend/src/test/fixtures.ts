import { nanoid } from "nanoid";
import type { AuthContext } from "../auth";
import type { Database, Lesson, LessonParticipant, RecurringSchedule, Student } from "@crm/shared";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { accounts } from "../db/schema";
import { ensureAccountDefaults, loadAccountDatabase } from "../db/repository";
import { buildLesson, createDefaultSettings, now } from "../store-logic";

function createEmptyDatabase(overrides?: Partial<Database>): Database {
  return {
    students: [],
    lessonPackages: [],
    lessons: [],
    recurringSchedules: [],
    payments: [],
    reminders: [],
    telegramInteractions: [],
    balanceAdjustments: [],
    vacationPeriods: [],
    settings: createDefaultSettings(),
    ...overrides
  };
}

function createStudentRecord(fullName: string): Student {
  const timestamp = now();
  return {
    id: nanoid(),
    fullName,
    telegramBindToken: nanoid(),
    status: "active",
    defaultLessonPrice: 3000,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createParticipant(studentId: string, status: LessonParticipant["status"] = "awaiting"): LessonParticipant {
  return {
    id: nanoid(),
    studentId,
    status,
    balanceCharged: false,
    hasDebt: false
  };
}

function createLessonRecord(input: {
  db: Database;
  studentIds: string[];
  lessonType?: "individual" | "group";
  startsAt?: string;
  recurringScheduleId?: string;
  participantStatus?: LessonParticipant["status"];
}): Lesson {
  return buildLesson(input.db, {
    startsAt: input.startsAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    lessonType: input.lessonType ?? (input.studentIds.length > 1 ? "group" : "individual"),
    studentIds: input.studentIds,
    recurringScheduleId: input.recurringScheduleId
  });
}

function createRecurringSchedule(input: {
  startsAt: string;
  studentIds: string[];
  lessonType?: "individual" | "group";
}): RecurringSchedule {
  const startDate = new Date(input.startsAt);
  const timestamp = now();
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    id: nanoid(),
    weekday: startDate.getDay(),
    time: `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`,
    durationMinutes: input.lessonType === "group" ? 90 : 60,
    lessonType: input.lessonType ?? (input.studentIds.length > 1 ? "group" : "individual"),
    studentIds: input.studentIds,
    activeFrom: new Date(input.startsAt).toISOString(),
    skippedOccurrences: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function futureDate(daysFromNow: number, hour = 18, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

async function createTestAccount(): Promise<{ ctx: AuthContext; cleanup: () => Promise<void> }> {
  const id = nanoid();
  const timestamp = now();
  const email = `test-${id}@test.crm`;

  await db.insert(accounts).values({
    id,
    email,
    name: "Test Account",
    image: null,
    googleSub: `test-${id}`,
    plan: "premium",
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await ensureAccountDefaults(id);

  return {
    ctx: { accountId: id, email, plan: "premium" },
    cleanup: async () => {
      await db.delete(accounts).where(eq(accounts.id, id));
    }
  };
}

async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export {
  createEmptyDatabase,
  createLessonRecord,
  createParticipant,
  createRecurringSchedule,
  createStudentRecord,
  createTestAccount,
  futureDate,
  isDatabaseAvailable,
  loadAccountDatabase
};
