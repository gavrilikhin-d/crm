import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";
import { students } from "./db/schema";
import { db } from "./db/client";
import { createTestAccount, isDatabaseAvailable } from "./test/fixtures";

const deleteStudentAvatar = mock(async (_studentId: string) => {});
const deleteStudentAvatars = mock(async (_studentIds: string[]) => {});

mock.module("./avatars", () => ({
  isAvatarStorageConfigured: () => false,
  readStudentAvatar: async () => null,
  saveStudentAvatar: async () => {},
  deleteStudentAvatar,
  deleteStudentAvatars,
  ensureAvatarsDir: async () => {},
  studentAvatarPath: (studentId: string) => `/api/students/${studentId}/avatar`
}));

const { store } = await import("./store");

const databaseAvailable = await isDatabaseAvailable();

describe.skipIf(!databaseAvailable)("avatar deletion integration", () => {
  beforeEach(() => {
    deleteStudentAvatar.mockClear();
    deleteStudentAvatars.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test("deleteStudent removes the avatar from S3", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const student = await store.createStudent(ctx, { fullName: "Avatar Delete Student" });

      await store.deleteStudent(ctx, student.id);

      expect(deleteStudentAvatar).toHaveBeenCalledTimes(1);
      expect(deleteStudentAvatar).toHaveBeenCalledWith(student.id);
      expect(
        await db.select({ id: students.id }).from(students).where(eq(students.id, student.id))
      ).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  test("deleteAccount removes avatars for every student, not only students with avatarUrl", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const withAvatar = await store.createStudent(ctx, { fullName: "Student With Avatar" });
      const withoutAvatar = await store.createStudent(ctx, { fullName: "Student Without Avatar" });

      await db
        .update(students)
        .set({ avatarUrl: `/api/students/${withAvatar.id}/avatar` })
        .where(eq(students.id, withAvatar.id));

      await store.deleteAccount(ctx);

      expect(deleteStudentAvatars).toHaveBeenCalledTimes(1);
      const [studentIds] = deleteStudentAvatars.mock.calls[0]!;
      expect(studentIds.sort()).toEqual([withAvatar.id, withoutAvatar.id].sort());
    } finally {
      await cleanup();
    }
  });
});
