import "dotenv/config";
import { nanoid } from "nanoid";
import { db } from "./db/client";
import { accounts } from "./db/schema";
import { ensureAccountDefaults } from "./db/repository";
import { store } from "./store";
import type { AuthContext } from "./auth";

const timestamp = new Date().toISOString();
const accountId = nanoid();

await db.insert(accounts).values({
  id: accountId,
  email: "seed@local.crm",
  name: "Seed Account",
  image: null,
  googleSub: `seed-${accountId}`,
  plan: "standard",
  createdAt: timestamp,
  updatedAt: timestamp
});

await ensureAccountDefaults(accountId);

const ctx: AuthContext = {
  accountId,
  email: "seed@local.crm",
  plan: "standard"
};

const anna = await store.createStudent(ctx, {
  fullName: "Анна Смирнова",
  telegramUsername: "@anna_voice",
  defaultLessonPrice: 3000
});

const ivan = await store.createStudent(ctx, {
  fullName: "Иван Петров",
  telegramUsername: "@ivan_music",
  defaultLessonPrice: 3000
});

const maria = await store.createStudent(ctx, {
  fullName: "Мария Орлова",
  telegramUsername: "@maria_sings",
  defaultLessonPrice: 3000
});

const sophia = await store.createStudent(ctx, {
  fullName: "София Лебедева",
  telegramUsername: "@sophia_voice",
  telegramUserId: "1000000001",
  telegramChatId: "1000000001",
  defaultLessonPrice: 3000
});

const snapshot = await store.getSnapshot(ctx);
const fourLessonPackage = snapshot.lessonPackages.find((item) => item.lessonCount === 4);
const eightLessonPackage = snapshot.lessonPackages.find((item) => item.lessonCount === 8);

if (fourLessonPackage) {
  await store.createPayment(ctx, {
    studentId: anna.id,
    method: "transfer",
    packageId: fourLessonPackage.id
  });
}

if (eightLessonPackage) {
  await store.createPayment(ctx, {
    studentId: sophia.id,
    method: "transfer",
    packageId: eightLessonPackage.id
  });
}

await store.createPayment(ctx, {
  studentId: ivan.id,
  method: "cash",
  lessonCount: 1,
  amount: 3000
});

const weekStart = getCurrentMonday();

const mondayGroup = await store.createLesson(ctx, {
  startsAt: atWeekTime(weekStart, 0, 15, 0),
  lessonType: "group",
  studentIds: [anna.id, ivan.id, maria.id]
});
await store.setParticipantStatus(ctx, mondayGroup.id, anna.id, "confirmed");
await store.setParticipantStatus(ctx, mondayGroup.id, ivan.id, "confirmed");
await store.completeLesson(ctx, mondayGroup.id);

const tuesdayIndividual = await store.createLesson(ctx, {
  startsAt: atWeekTime(weekStart, 1, 11, 0),
  lessonType: "individual",
  studentIds: [sophia.id]
});
await store.setParticipantStatus(ctx, tuesdayIndividual.id, sophia.id, "confirmed");

const tuesdayEvening = await store.createLesson(ctx, {
  startsAt: atWeekTime(weekStart, 1, 18, 30),
  lessonType: "individual",
  studentIds: [anna.id]
});
await store.setParticipantStatus(ctx, tuesdayEvening.id, anna.id, "confirmed");

const wednesdayGroup = await store.createLesson(ctx, {
  startsAt: atWeekTime(weekStart, 2, 13, 30),
  lessonType: "group",
  studentIds: [anna.id, ivan.id, sophia.id]
});
await store.setParticipantStatus(ctx, wednesdayGroup.id, anna.id, "confirmed");
await store.setParticipantStatus(ctx, wednesdayGroup.id, ivan.id, "declined");
await store.setParticipantStatus(ctx, wednesdayGroup.id, sophia.id, "declined");

await store
  .createLesson(ctx, {
    startsAt: atWeekTime(weekStart, 3, 16, 0),
    lessonType: "individual",
    studentIds: [maria.id]
  })
  .then((lesson) => store.completeLesson(ctx, lesson.id));

const fridayGroup = await store.createLesson(ctx, {
  startsAt: atWeekTime(weekStart, 4, 12, 0),
  lessonType: "group",
  studentIds: [anna.id, maria.id, sophia.id]
});
await store.setParticipantStatus(ctx, fridayGroup.id, anna.id, "confirmed");
await store.setParticipantStatus(ctx, fridayGroup.id, maria.id, "confirmed");

const saturdayIndividual = await store.createLesson(ctx, {
  startsAt: atWeekTime(weekStart, 5, 10, 30),
  lessonType: "individual",
  studentIds: [ivan.id]
});
await store.setParticipantStatus(ctx, saturdayIndividual.id, ivan.id, "confirmed");
await store.completeLesson(ctx, saturdayIndividual.id);

console.log("Seed data created");

function getCurrentMonday(): Date {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay() || 7;
  monday.setDate(today.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function atWeekTime(weekStart: Date, dayOffset: number, hour: number, minute: number): string {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}
