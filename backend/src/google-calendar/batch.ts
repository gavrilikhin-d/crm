export const GOOGLE_CALENDAR_BATCH_URL = "https://www.googleapis.com/batch/calendar/v3";
export const GOOGLE_CALENDAR_BATCH_SIZE = 50;

export type GoogleCalendarBatchPart = {
  contentId: string;
  method: "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
};

export type GoogleCalendarBatchPartResult = {
  contentId: string;
  status: number;
  body: unknown;
};

export function chunkGoogleCalendarBatchParts<T>(items: T[], size = GOOGLE_CALENDAR_BATCH_SIZE): T[][] {
  if (size <= 0) {
    throw new Error("Batch size must be positive");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function buildGoogleCalendarBatchBody(parts: GoogleCalendarBatchPart[], boundary: string): string {
  const segments = parts.map((part) => {
    let nestedRequest = `${part.method} ${part.path}\r\n`;

    if (part.body !== undefined) {
      const json = JSON.stringify(part.body);
      nestedRequest +=
        `Content-Type: application/json; charset=UTF-8\r\n` +
        `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n` +
        `\r\n` +
        json;
    } else {
      nestedRequest += "\r\n";
    }

    return (
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-ID: <${part.contentId}>\r\n` +
      `\r\n` +
      `${nestedRequest}\r\n`
    );
  });

  return `${segments.join("")}--${boundary}--\r\n`;
}

export function extractMultipartBoundary(contentType: string | null | undefined): string | null {
  if (!contentType) {
    return null;
  }

  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  return match?.[1] ?? match?.[2] ?? null;
}

function normalizeContentId(value: string): string {
  return value.replace(/^response-/, "").replace(/^<|>$/g, "");
}

export function parseGoogleCalendarBatchResponse(
  raw: string,
  boundary: string
): GoogleCalendarBatchPartResult[] {
  const parts = raw.split(`--${boundary}`);
  const results: GoogleCalendarBatchPartResult[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "--") {
      continue;
    }

    const contentIdMatch = /Content-ID:\s*<?([^>\r\n]+)>?/i.exec(part);
    const statusMatch = /HTTP\/[\d.]+\s+(\d+)/i.exec(part);
    if (!contentIdMatch || !statusMatch) {
      continue;
    }

    const nestedStart = part.search(/HTTP\/[\d.]+/i);
    const nested = nestedStart >= 0 ? part.slice(nestedStart) : part;
    const headerBodySplit = nested.split(/\r\n\r\n|\n\n/);
    const bodyText = headerBodySplit.slice(1).join("\n\n").trim();

    let body: unknown = null;
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText;
      }
    }

    results.push({
      contentId: normalizeContentId(contentIdMatch[1] ?? ""),
      status: Number(statusMatch[1]),
      body
    });
  }

  return results;
}

export function calendarEventsPath(calendarId: string, eventId?: string): string {
  const base = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}
