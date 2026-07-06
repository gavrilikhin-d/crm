import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

const S3_PREFIX = "avatars/";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

type S3Config = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
};

let s3Client: S3Client | null = null;

export function isAvatarStorageConfigured(): boolean {
  return Boolean(process.env.S3_BUCKET?.trim());
}

function getS3Config(): S3Config {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required for avatar storage");
  }

  return {
    bucket,
    region: process.env.AWS_REGION?.trim() || "eu-central-1",
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true"
  };
}

function getS3Client(): S3Client {
  if (!s3Client) {
    const { region, endpoint, forcePathStyle } = getS3Config();
    s3Client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle } : {})
    });
  }
  return s3Client;
}

export function studentAvatarPath(studentId: string): string {
  return `/api/students/${studentId}/avatar`;
}

export async function ensureAvatarsDir(): Promise<void> {
  if (!isAvatarStorageConfigured()) {
    console.warn("[avatars] S3_BUCKET is not set; avatar upload and serving are disabled");
    return;
  }

  getS3Config();
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

async function findAvatarKey(studentId: string): Promise<string | null> {
  const { bucket } = getS3Config();
  const response = await getS3Client().send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${S3_PREFIX}${studentId}.`,
      MaxKeys: 1
    })
  );

  return response.Contents?.[0]?.Key ?? null;
}

export async function saveStudentAvatar(studentId: string, dataUrl: string): Promise<void> {
  await deleteStudentAvatar(studentId);

  const { mime, buffer } = parseDataUrl(dataUrl);
  const { bucket } = getS3Config();
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${S3_PREFIX}${studentId}${extensionForMime(mime)}`,
      Body: buffer,
      ContentType: mime,
      CacheControl: "no-cache"
    })
  );
}

export async function deleteStudentAvatar(studentId: string): Promise<void> {
  if (!isAvatarStorageConfigured()) {
    return;
  }

  const key = await findAvatarKey(studentId);
  if (!key) {
    return;
  }

  const { bucket } = getS3Config();
  await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteStudentAvatars(studentIds: string[]): Promise<void> {
  if (!studentIds.length || !isAvatarStorageConfigured()) {
    return;
  }

  const results = await Promise.allSettled(studentIds.map((studentId) => deleteStudentAvatar(studentId)));
  const failedDeletes = results.filter((result) => result.status === "rejected");
  if (failedDeletes.length) {
    console.warn(`[avatars] Failed to delete ${failedDeletes.length} student avatar(s) from S3`);
  }
}

export async function readStudentAvatar(
  studentId: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const key = await findAvatarKey(studentId);
  if (!key) {
    return null;
  }

  const { bucket } = getS3Config();
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes || bytes.length === 0) {
    return null;
  }

  const ext = key.slice(key.lastIndexOf("."));
  const mime =
    response.ContentType ??
    Object.entries(MIME_TO_EXT).find(([, value]) => value === ext)?.[0] ??
    "application/octet-stream";

  return { buffer: Buffer.from(bytes), mime };
}
