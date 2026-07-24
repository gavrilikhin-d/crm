import { describe, expect, test } from "bun:test";
import {
  buildGoogleCalendarBatchBody,
  calendarEventsPath,
  chunkGoogleCalendarBatchParts,
  extractMultipartBoundary,
  parseGoogleCalendarBatchResponse
} from "./batch";

describe("google calendar batch helpers", () => {
  test("chunks parts into fixed-size batches", () => {
    expect(chunkGoogleCalendarBatchParts([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("builds multipart request body with nested HTTP parts", () => {
    const body = buildGoogleCalendarBatchBody(
      [
        {
          contentId: "insert:lesson-1",
          method: "POST",
          path: calendarEventsPath("primary"),
          body: { summary: "Anna Ivanova 1/8" }
        },
        {
          contentId: "delete:lesson-2",
          method: "DELETE",
          path: calendarEventsPath("primary", "event-2")
        }
      ],
      "batch_boundary"
    );

    expect(body).toContain("Content-ID: <insert:lesson-1>");
    expect(body).toContain("POST /calendar/v3/calendars/primary/events");
    expect(body).toContain('"summary":"Anna Ivanova 1/8"');
    expect(body).toContain("DELETE /calendar/v3/calendars/primary/events/event-2");
    expect(body.endsWith("--batch_boundary--\r\n")).toBe(true);
  });

  test("parses multipart batch responses and strips response- prefix", () => {
    const raw = [
      "--batch_boundary",
      "Content-Type: application/http",
      "Content-ID: <response-insert:lesson-1>",
      "",
      "HTTP/1.1 200 OK",
      "Content-Type: application/json",
      "",
      '{"id":"event-1","summary":"Anna"}',
      "--batch_boundary",
      "Content-Type: application/http",
      "Content-ID: <response-delete:lesson-2>",
      "",
      "HTTP/1.1 204 No Content",
      "",
      "",
      "--batch_boundary--"
    ].join("\r\n");

    expect(parseGoogleCalendarBatchResponse(raw, "batch_boundary")).toEqual([
      { contentId: "insert:lesson-1", status: 200, body: { id: "event-1", summary: "Anna" } },
      { contentId: "delete:lesson-2", status: 204, body: null }
    ]);
  });

  test("extracts multipart boundary from content type", () => {
    expect(extractMultipartBoundary('multipart/mixed; boundary=batch_boundary')).toBe("batch_boundary");
    expect(extractMultipartBoundary('multipart/mixed; boundary="batch_boundary"')).toBe("batch_boundary");
  });

  test("encodes calendar and event ids in paths", () => {
    expect(calendarEventsPath("user@example.com", "abc/def")).toBe(
      "/calendar/v3/calendars/user%40example.com/events/abc%2Fdef"
    );
  });
});
