import { rm } from "node:fs/promises";
import { join } from "node:path";
import { store } from "./store";

await rm(process.env.DATA_FILE_PATH ?? join(process.cwd(), "data", "db.json"), { force: true });

const anna = await store.createStudent({
  fullName: "Анна Смирнова",
  phone: "+7 900 111-22-33",
  telegramUsername: "@anna_voice",
  defaultLessonPrice: 3000
});

const ivan = await store.createStudent({
  fullName: "Иван Петров",
  phone: "+7 900 444-55-66",
  telegramUsername: "@ivan_music",
  defaultLessonPrice: 3000
});

const maria = await store.createStudent({
  fullName: "Мария Орлова",
  phone: "+7 900 777-88-99",
  telegramUsername: "@maria_sings",
  defaultLessonPrice: 3000
});

const sophia = await store.createStudent({
  fullName: "София Лебедева",
  phone: "+7 900 222-33-44",
  telegramUsername: "@sophia_voice",
  telegramChatId: "1000000001",
  defaultLessonPrice: 3000
});

const snapshot = await store.getSnapshot();
const fourLessonPackage = snapshot.lessonPackages.find((item) => item.lessonCount === 4);
const eightLessonPackage = snapshot.lessonPackages.find((item) => item.lessonCount === 8);

if (fourLessonPackage) {
  await store.createPayment({
    studentId: anna.id,
    method: "transfer",
    packageId: fourLessonPackage.id
  });
}

if (eightLessonPackage) {
  await store.createPayment({
    studentId: sophia.id,
    method: "transfer",
    packageId: eightLessonPackage.id
  });
}

await store.createPayment({
  studentId: ivan.id,
  method: "cash",
  lessonCount: 1,
  amount: 3000
});

const weekStart = getCurrentMonday();

const mondayGroup = await store.createLesson({
  startsAt: atWeekTime(weekStart, 0, 15, 0),
  durationMinutes: 90,
  lessonType: "group",
  studentIds: [anna.id, ivan.id, maria.id]
});
await store.setParticipantStatus(mondayGroup.id, anna.id, "confirmed");
await store.setParticipantStatus(mondayGroup.id, ivan.id, "confirmed");
await store.completeLesson(mondayGroup.id);

const tuesdayIndividual = await store.createLesson({
  startsAt: atWeekTime(weekStart, 1, 11, 0),
  durationMinutes: 60,
  lessonType: "individual",
  studentIds: [sophia.id]
});
await store.setParticipantStatus(tuesdayIndividual.id, sophia.id, "confirmed");

const tuesdayEvening = await store.createLesson({
  startsAt: atWeekTime(weekStart, 1, 18, 30),
  durationMinutes: 60,
  lessonType: "individual",
  studentIds: [anna.id]
});
await store.setParticipantStatus(tuesdayEvening.id, anna.id, "confirmed");

const wednesdayGroup = await store.createLesson({
  startsAt: atWeekTime(weekStart, 2, 13, 30),
  durationMinutes: 90,
  lessonType: "group",
  studentIds: [anna.id, ivan.id, sophia.id]
});
await store.setParticipantStatus(wednesdayGroup.id, anna.id, "confirmed");
await store.setParticipantStatus(wednesdayGroup.id, ivan.id, "declined");
await store.setParticipantStatus(wednesdayGroup.id, sophia.id, "declined");

await store.createLesson({
  startsAt: atWeekTime(weekStart, 3, 16, 0),
  durationMinutes: 60,
  lessonType: "individual",
  studentIds: [maria.id]
}).then((lesson) => store.completeLesson(lesson.id));

const fridayGroup = await store.createLesson({
  startsAt: atWeekTime(weekStart, 4, 12, 0),
  durationMinutes: 90,
  lessonType: "group",
  studentIds: [anna.id, maria.id, sophia.id]
});
await store.setParticipantStatus(fridayGroup.id, anna.id, "confirmed");
await store.setParticipantStatus(fridayGroup.id, maria.id, "confirmed");

const saturdayIndividual = await store.createLesson({
  startsAt: atWeekTime(weekStart, 5, 10, 30),
  durationMinutes: 60,
  lessonType: "individual",
  studentIds: [ivan.id]
});
await store.setParticipantStatus(saturdayIndividual.id, ivan.id, "confirmed");
await store.completeLesson(saturdayIndividual.id);

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
