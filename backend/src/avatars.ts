import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const AVATARS_DIR = join(process.cwd(), "data/avatars");
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

export function studentAvatarPath(studentId: string): string {
  return `/api/students/${studentId}/avatar`;
}

export async function ensureAvatarsDir(): Promise<void> {
  await mkdir(AVATARS_DIR, { recursive: true });
}

function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? ".jpg";
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Invalid avatar image format");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) {
    throw new Error("Avatar image is empty");
  }
  if (buffer.length > MAX_AVATAR_BYTES) {
    throw new Error("Avatar image is too large");
  }

  return { mime: match[1].toLowerCase(), buffer };
}

async function findAvatarFile(studentId: string): Promise<string | null> {
  const entries = await readdir(AVATARS_DIR).catch(() => [] as string[]);
  const match = entries.find((entry) => entry.startsWith(`${studentId}.`));
  return match ? join(AVATARS_DIR, match) : null;
}

export async function saveStudentAvatar(studentId: string, dataUrl: string): Promise<void> {
  await ensureAvatarsDir();
  await deleteStudentAvatar(studentId);

  const { mime, buffer } = parseDataUrl(dataUrl);
  const filePath = join(AVATARS_DIR, `${studentId}${extensionForMime(mime)}`);
  await writeFile(filePath, buffer);
}

export async function deleteStudentAvatar(studentId: string): Promise<void> {
  const existing = await findAvatarFile(studentId);
  if (existing) {
    await unlink(existing);
  }
}

export async function readStudentAvatar(
  studentId: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const filePath = await findAvatarFile(studentId);
  if (!filePath) {
    return null;
  }

  const ext = filePath.slice(filePath.lastIndexOf("."));
  const mime =
    Object.entries(MIME_TO_EXT).find(([, value]) => value === ext)?.[0] ?? "application/octet-stream";
  const buffer = await readFile(filePath);
  return { buffer, mime };
}
