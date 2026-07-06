import { afterEach, describe, expect, test } from "bun:test";
import { deleteStudentAvatar, deleteStudentAvatars } from "./avatars";

const originalBucket = process.env.S3_BUCKET;

afterEach(() => {
  if (originalBucket === undefined) {
    delete process.env.S3_BUCKET;
  } else {
    process.env.S3_BUCKET = originalBucket;
  }
});

describe("avatar deletion without S3", () => {
  test("deleteStudentAvatar no-ops when S3_BUCKET is unset", async () => {
    delete process.env.S3_BUCKET;
    await expect(deleteStudentAvatar("student-1")).resolves.toBeUndefined();
  });

  test("deleteStudentAvatars no-ops when S3_BUCKET is unset", async () => {
    delete process.env.S3_BUCKET;
    await expect(deleteStudentAvatars(["student-1", "student-2"])).resolves.toBeUndefined();
  });

  test("deleteStudentAvatars no-ops for an empty list", async () => {
    process.env.S3_BUCKET = "test-bucket";
    await expect(deleteStudentAvatars([])).resolves.toBeUndefined();
  });
});
