import { afterEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestAccount, isDatabaseAvailable } from "./test/fixtures";
import { db } from "./db/client";
import { accounts } from "./db/schema";
import { store } from "./store";

const canRun = await isDatabaseAvailable();

describe.skipIf(!canRun)("telegram teacher context", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length) {
      const cleanup = cleanups.pop();
      if (cleanup) {
        await cleanup();
      }
    }
  });

  test("profile uses one student when telegram user is linked to multiple teachers", async () => {
    const alice = await createTestAccount({ name: "Alice Teacher" });
    const bob = await createTestAccount({ name: "Bob Teacher" });
    cleanups.push(alice.cleanup, bob.cleanup);

    const aliceStudent = await store.createStudent(alice.ctx, { fullName: "Shared Student" });
    const bobStudent = await store.createStudent(bob.ctx, { fullName: "Shared Student" });

    await store.bindTelegramChat(aliceStudent.telegramBindToken, "chat-shared", "tg-shared");
    await store.bindTelegramChat(bobStudent.telegramBindToken, "chat-shared", "tg-shared");

    const profile = await store.getTelegramStudentProfile("tg-shared");
    expect(profile.teachers).toHaveLength(2);
    expect(profile.teachers.map((item) => item.name).sort()).toEqual(["Alice Teacher", "Bob Teacher"]);
    // Latest bind becomes the active context.
    expect(profile.teacher.studentId).toBe(bobStudent.id);
    expect(profile.teacher.name).toBe("Bob Teacher");
    expect(profile.student.id).toBe(bobStudent.id);
  });

  test("switchTelegramTeacherContext changes which teacher profile is active", async () => {
    const alice = await createTestAccount({ name: "Alice Teacher" });
    const bob = await createTestAccount({ name: "Bob Teacher" });
    cleanups.push(alice.cleanup, bob.cleanup);

    const aliceStudent = await store.createStudent(alice.ctx, { fullName: "Shared Student" });
    const bobStudent = await store.createStudent(bob.ctx, { fullName: "Shared Student" });

    await store.bindTelegramChat(aliceStudent.telegramBindToken, "chat-switch", "tg-switch");
    await store.bindTelegramChat(bobStudent.telegramBindToken, "chat-switch", "tg-switch");

    const switched = await store.switchTelegramTeacherContext("tg-switch", aliceStudent.id);
    expect(switched.teacher.studentId).toBe(aliceStudent.id);
    expect(switched.teacher.name).toBe("Alice Teacher");

    const profile = await store.getTelegramStudentProfile("tg-switch");
    expect(profile.teacher.studentId).toBe(aliceStudent.id);
    expect(profile.student.id).toBe(aliceStudent.id);
  });

  test("switchTelegramTeacherContext rejects students not linked to this telegram user", async () => {
    const alice = await createTestAccount({ name: "Alice Teacher" });
    const bob = await createTestAccount({ name: "Bob Teacher" });
    cleanups.push(alice.cleanup, bob.cleanup);

    const aliceStudent = await store.createStudent(alice.ctx, { fullName: "Alice Student" });
    const bobStudent = await store.createStudent(bob.ctx, { fullName: "Bob Student" });

    await store.bindTelegramChat(aliceStudent.telegramBindToken, "chat-reject", "tg-reject");

    await expect(store.switchTelegramTeacherContext("tg-reject", bobStudent.id)).rejects.toThrow(
      "Student not linked"
    );
  });

  test("preferences update applies to the active teacher student only", async () => {
    const alice = await createTestAccount({ name: "Alice Teacher" });
    const bob = await createTestAccount({ name: "Bob Teacher" });
    cleanups.push(alice.cleanup, bob.cleanup);

    const aliceStudent = await store.createStudent(alice.ctx, { fullName: "Shared Student" });
    const bobStudent = await store.createStudent(bob.ctx, { fullName: "Shared Student" });

    await store.bindTelegramChat(aliceStudent.telegramBindToken, "chat-prefs", "tg-prefs");
    await store.bindTelegramChat(bobStudent.telegramBindToken, "chat-prefs", "tg-prefs");
    await store.switchTelegramTeacherContext("tg-prefs", aliceStudent.id);

    await store.updateTelegramStudentPreferences("tg-prefs", { timezone: "Europe/Moscow" });

    const aliceDb = await store.getSnapshot(alice.ctx);
    const bobDb = await store.getSnapshot(bob.ctx);
    expect(aliceDb.students.find((item) => item.id === aliceStudent.id)?.timezone).toBe("Europe/Moscow");
    expect(bobDb.students.find((item) => item.id === bobStudent.id)?.timezone ?? null).toBeNull();
  });

  test("single-teacher profile still exposes teacher list of one", async () => {
    const { ctx, cleanup } = await createTestAccount({ name: "Solo Teacher" });
    cleanups.push(cleanup);

    const student = await store.createStudent(ctx, { fullName: "Solo Student" });
    await store.bindTelegramChat(student.telegramBindToken, "chat-solo", "tg-solo");

    const profile = await store.getTelegramStudentProfile("tg-solo");
    expect(profile.teachers).toHaveLength(1);
    expect(profile.teacher.name).toBe("Solo Teacher");
    expect(profile.teacher.studentId).toBe(student.id);
  });
});

describe.skipIf(!canRun)("createTestAccount name option", () => {
  test("persists custom account name", async () => {
    const { ctx, cleanup } = await createTestAccount({ name: "Named Teacher" });
    try {
      const rows = await db.select().from(accounts).where(eq(accounts.id, ctx.accountId)).limit(1);
      expect(rows[0]?.name).toBe("Named Teacher");
    } finally {
      await cleanup();
    }
  });
});
