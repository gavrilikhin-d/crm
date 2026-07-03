import type { NextRequest } from "next/server";

const backendUrl = () => process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
const reminderUrl = () => process.env.REMINDER_INTERNAL_URL ?? "http://localhost:4001";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = params.path.join("/");
  const baseUrl = path.startsWith("payment-reminders/") ? reminderUrl() : backendUrl();
  const target = new URL(`/api/${path}${request.nextUrl.search}`, baseUrl);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    cache: "no-store"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // Node fetch requires this when forwarding a streaming request body.
    init.duplex = "half";
  }

  const response = await fetch(target, init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
