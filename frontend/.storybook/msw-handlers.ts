import { http, HttpResponse } from "msw";
import { settings, snapshot, vacationPeriods } from "./fixtures";

export const mswHandlers = {
  auth: [
    http.get("/api/auth/session", () =>
      HttpResponse.json({
        user: {
          name: "Даниил",
          email: "teacher@example.com",
          image: null
        },
        expires: "2024-04-02T12:00:00.000Z"
      })
    ),
    http.get("/api/auth/token", () => HttpResponse.json({ token: "storybook-token" }))
  ],
  snapshot: [
    http.get("/api/snapshot", ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("fields") === "calendar") {
        return HttpResponse.json({
          lessons: snapshot.lessons,
          vacationPeriods: snapshot.vacationPeriods
        });
      }
      return HttpResponse.json(snapshot);
    })
  ],
  settings: [
    http.patch("/api/settings", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      return HttpResponse.json({ ...settings, ...body });
    }),
    http.delete("/api/account", () => HttpResponse.json({ ok: true }))
  ],
  calendar: [
    http.get("/api/google-calendar/status", () =>
      HttpResponse.json({
        connected: true,
        syncEnabled: true,
        calendarId: "storybook-calendar"
      })
    ),
    http.get("/api/google-calendar/connect", () => HttpResponse.json({ url: "https://calendar.example.test/connect" })),
    http.delete("/api/google-calendar/disconnect", () => HttpResponse.json({ ok: true })),
    http.post("/api/google-calendar/sync", () => HttpResponse.json({ synced: 3, failed: 0 }))
  ],
  vacation: [
    http.post("/api/vacation-periods", () =>
      HttpResponse.json({
        period: vacationPeriods[0],
        cancelledLessons: 2
      })
    ),
    http.delete("/api/vacation-periods/:id", () => HttpResponse.json({ ok: true }))
  ],
  mutations: [
    http.post("/api/students", () => HttpResponse.json(snapshot.students[0])),
    http.patch("/api/students/:id", () => HttpResponse.json(snapshot.students[0])),
    http.delete("/api/students/:id", () => HttpResponse.json({ ok: true })),
    http.post("/api/lessons", () => HttpResponse.json(snapshot.lessons[0])),
    http.delete("/api/lessons/:id", () => HttpResponse.json({ ok: true })),
    http.delete("/api/lessons/:lessonId/participants/:studentId", () => HttpResponse.json(snapshot.lessons[0])),
    http.post("/api/lessons/:lessonId/participants/:studentId/status", () => HttpResponse.json(snapshot.lessons[0])),
    http.post("/api/lessons/:lessonId/participants", () => HttpResponse.json(snapshot.lessons[0])),
    http.post("/api/payments", () => HttpResponse.json(snapshot.payments[0])),
    http.post("/api/lesson-packages", () => HttpResponse.json(snapshot.lessonPackages[0])),
    http.delete("/api/lesson-packages/:id", () => HttpResponse.json({ ok: true }))
  ]
};
