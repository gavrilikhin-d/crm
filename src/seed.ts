import { rm } from "node:fs/promises";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { store } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
await rm(join(__dirname, "..", "data", "db.json"), { force: true });

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

const snapshot = await store.getSnapshot();
const fourLessonPackage = snapshot.lessonPackages.find((item) => item.lessonCount === 4);
if (fourLessonPackage) {
  await store.createPayment({
    studentId: anna.id,
    method: "transfer",
    packageId: fourLessonPackage.id
  });
}

await store.createPayment({
  studentId: ivan.id,
  method: "cash",
  lessonCount: 1,
  amount: 3000
});

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
tomorrow.setMinutes(0, 0, 0);

await store.createLesson({
  startsAt: tomorrow.toISOString(),
  lessonType: "group",
  studentIds: [anna.id, ivan.id, maria.id]
});

await store.createLesson({
  startsAt: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(),
  lessonType: "individual",
  studentIds: [anna.id]
});

console.log("Seed data created");
