import { describe, expect, test } from "bun:test";
import { createTestAccount, futureDate, isDatabaseAvailable, loadAccountDatabase } from "./test/fixtures";
import { isOccurrenceSkipped } from "./store-logic";
import { store } from "./store";

const databaseAvailable = await isDatabaseAvailable();

describe.skipIf(!databaseAvailable)("lesson lifecycle integration", () => {
  async function setupAccount() {
    return createTestAccount();
  }

  test("deletes one-off lesson when the last participant is removed", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice OneOff" });
      const lesson = await store.createLesson(ctx, {
        startsAt: futureDate(10, 18, 0),
        lessonType: "individual",
        studentIds: [alice.id]
      });

      const result = await store.removeLessonParticipant(ctx, lesson.id, alice.id);

      expect(result).toBeNull();

      const db = await loadAccountDatabase(ctx.accountId);
      expect(db.lessons.some((item) => item.id === lesson.id)).toBe(false);
    } finally {
      await localCleanup();
    }
  });

  test("deletes recurring occurrence and skips rematerialization when last participant is removed", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Recurring Delete" });
      const bob = await store.createStudent(ctx, { fullName: "Bob Recurring Delete" });
      const startsAt = futureDate(14, 18, 0);

      const lesson = await store.createLesson(ctx, {
        startsAt,
        lessonType: "group",
        studentIds: [alice.id, bob.id],
        repeatWeekly: true
      });

      await store.removeLessonParticipant(ctx, lesson.id, alice.id);
      const afterOneRemoved = await loadAccountDatabase(ctx.accountId);
      const converted = afterOneRemoved.lessons.find((item) => item.id === lesson.id);

      expect(converted?.effectiveType).toBe("individual");
      expect(converted?.durationMinutes).toBe(60);

      await store.removeLessonParticipant(ctx, lesson.id, bob.id);

      const db = await loadAccountDatabase(ctx.accountId);
      expect(db.lessons.some((item) => item.id === lesson.id)).toBe(false);

      const schedule = db.recurringSchedules.find((item) => item.id === lesson.recurringScheduleId);
      expect(schedule).toBeDefined();
      expect(isOccurrenceSkipped(schedule!, startsAt)).toBe(true);

      const snapshot = await store.getSnapshot(ctx);
      expect(snapshot.lessons.some((item) => item.id === lesson.id)).toBe(false);
      expect(
        snapshot.lessons.some(
          (item) =>
            item.recurringScheduleId === lesson.recurringScheduleId &&
            new Date(item.startsAt).getTime() === new Date(startsAt).getTime()
        )
      ).toBe(false);
      expect(
        snapshot.lessons.filter((item) => item.recurringScheduleId === lesson.recurringScheduleId).length
      ).toBeGreaterThan(0);
    } finally {
      await localCleanup();
    }
  });

  test("converts one-off group lesson to individual after removing a participant", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Group OneOff" });
      const bob = await store.createStudent(ctx, { fullName: "Bob Group OneOff" });
      const lesson = await store.createLesson(ctx, {
        startsAt: futureDate(11, 18, 0),
        lessonType: "group",
        studentIds: [alice.id, bob.id]
      });

      const updated = await store.removeLessonParticipant(ctx, lesson.id, bob.id);

      expect(updated?.effectiveType).toBe("individual");
      expect(updated?.durationMinutes).toBe(60);
      expect(updated?.originalType).toBe("group");
      expect(updated?.participants).toHaveLength(1);
    } finally {
      await localCleanup();
    }
  });

  test("converts recurring group lesson to individual after removing a participant", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Recurring Convert" });
      const bob = await store.createStudent(ctx, { fullName: "Bob Recurring Convert" });
      const lesson = await store.createLesson(ctx, {
        startsAt: futureDate(21, 18, 0),
        lessonType: "group",
        studentIds: [alice.id, bob.id],
        repeatWeekly: true
      });

      const updated = await store.removeLessonParticipant(ctx, lesson.id, bob.id);

      expect(updated?.effectiveType).toBe("individual");
      expect(updated?.durationMinutes).toBe(60);
      expect(updated?.originalType).toBe("group");

      const snapshot = await store.getSnapshot(ctx);
      const sameLesson = snapshot.lessons.find((item) => item.id === lesson.id);
      expect(sameLesson?.effectiveType).toBe("individual");
    } finally {
      await localCleanup();
    }
  });

  test("promotes individual lesson to group when another student is added", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Promote" });
      const bob = await store.createStudent(ctx, { fullName: "Bob Promote" });
      const lesson = await store.createLesson(ctx, {
        startsAt: futureDate(12, 18, 0),
        lessonType: "individual",
        studentIds: [alice.id]
      });

      const updated = await store.addLessonParticipants(ctx, lesson.id, [bob.id]);

      expect(updated.originalType).toBe("group");
      expect(updated.effectiveType).toBe("group");
      expect(updated.durationMinutes).toBe(90);
      expect(updated.participants).toHaveLength(2);
    } finally {
      await localCleanup();
    }
  });

  test("deletes all lessons in a recurring series", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Delete All" });
      const bob = await store.createStudent(ctx, { fullName: "Bob Delete All" });
      const lesson = await store.createLesson(ctx, {
        startsAt: futureDate(28, 18, 0),
        lessonType: "group",
        studentIds: [alice.id, bob.id],
        repeatWeekly: true
      });

      const scheduleId = lesson.recurringScheduleId!;
      await store.getSnapshot(ctx);

      await store.deleteLesson(ctx, lesson.id, "all");

      const db = await loadAccountDatabase(ctx.accountId);
      expect(db.lessons.some((item) => item.recurringScheduleId === scheduleId)).toBe(false);
      expect(db.recurringSchedules.some((item) => item.id === scheduleId)).toBe(false);
    } finally {
      await localCleanup();
    }
  });

  test("leaves other recurring occurrences intact when one occurrence is cleared", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Other Weeks" });
      const bob = await store.createStudent(ctx, { fullName: "Bob Other Weeks" });
      const startsAt = futureDate(35, 18, 0);
      const lesson = await store.createLesson(ctx, {
        startsAt,
        lessonType: "group",
        studentIds: [alice.id, bob.id],
        repeatWeekly: true
      });

      const snapshot = await store.getSnapshot(ctx);
      const seriesLessons = snapshot.lessons.filter((item) => item.recurringScheduleId === lesson.recurringScheduleId);
      expect(seriesLessons.length).toBeGreaterThan(1);

      const otherLesson = seriesLessons.find((item) => item.id !== lesson.id)!;

      await store.removeLessonParticipant(ctx, lesson.id, alice.id);
      await store.removeLessonParticipant(ctx, lesson.id, bob.id);

      const afterDelete = await store.getSnapshot(ctx);
      expect(afterDelete.lessons.some((item) => item.id === lesson.id)).toBe(false);
      expect(afterDelete.lessons.some((item) => item.id === otherLesson.id)).toBe(true);
      expect(
        afterDelete.lessons.filter((item) => item.recurringScheduleId === lesson.recurringScheduleId).length
      ).toBe(seriesLessons.length - 1);
    } finally {
      await localCleanup();
    }
  });

  test("student cannot change attendance on a past lesson", async () => {
    const { ctx, cleanup: localCleanup } = await setupAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Past Attendance" });
      const lesson = await store.createLesson(ctx, {
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        lessonType: "individual",
        studentIds: [alice.id]
      });

      await expect(
        store.setParticipantStatusForAccount(ctx.accountId, lesson.id, alice.id, "confirmed", "attend")
      ).rejects.toThrow("Cannot change attendance for a past lesson");
    } finally {
      await localCleanup();
    }
  });
});
