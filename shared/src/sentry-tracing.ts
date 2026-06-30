import type { IncomingMessage, ServerResponse } from "node:http";
import * as Sentry from "@sentry/node";
import { parameterizePath, tracesSampler } from "./sentry-sampling";

export { parameterizePath, tracesSampler } from "./sentry-sampling";

type SpanAttributes = Record<string, string | number | boolean>;

export function withSentrySpan<T>(
  name: string,
  op: string,
  fn: () => T | Promise<T>,
  attributes?: SpanAttributes,
  options?: { forceTransaction?: boolean }
): Promise<T> {
  return Promise.resolve(
    Sentry.startSpan(
      {
        name,
        op,
        attributes,
        forceTransaction: options?.forceTransaction
      },
      fn
    )
  );
}

export async function withIncomingHttpSpan<T>(
  request: IncomingMessage,
  response: ServerResponse,
  routeName: string,
  handler: () => Promise<T>
): Promise<T> {
  const sentryTrace = request.headers["sentry-trace"];
  const baggage = request.headers["baggage"];

  return Sentry.continueTrace(
    {
      sentryTrace: typeof sentryTrace === "string" ? sentryTrace : sentryTrace?.[0],
      baggage: typeof baggage === "string" ? baggage : baggage?.[0]
    },
    () =>
      Sentry.startSpanManual(
        {
          name: routeName,
          op: "http.server",
          attributes: {
            "http.method": request.method ?? "GET",
            "http.route": routeName
          }
        },
        async (span) => {
          try {
            const result = await handler();
            span.setAttribute("http.status_code", response.statusCode);
            span.setStatus({ code: response.statusCode < 400 ? 1 : 2 });
            return result;
          } catch (error) {
            span.setStatus({
              code: 2,
              message: error instanceof Error ? error.message : "error"
            });
            throw error;
          } finally {
            span.end();
          }
        }
      )
  );
}

export async function fetchWithSentryTrace(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? "GET";
  const parsedUrl = new URL(url, url.startsWith("http") ? undefined : "http://localhost");
  const headers = new Headers(init.headers);
  const traceData = Sentry.getTraceData();

  if (traceData["sentry-trace"]) {
    headers.set("sentry-trace", traceData["sentry-trace"]);
  }
  if (traceData.baggage) {
    headers.set("baggage", traceData.baggage);
  }

  return Sentry.startSpan(
    {
      name: `${method} ${parameterizePath(parsedUrl.pathname)}`,
      op: "http.client",
      attributes: {
        "http.method": method,
        "http.url": url
      }
    },
    async (span) => {
      const response = await fetch(url, { ...init, headers });
      span.setAttribute("http.status_code", response.status);
      if (!response.ok) {
        span.setStatus({ code: 2, message: `HTTP ${response.status}` });
      }
      return response;
    }
  );
}
