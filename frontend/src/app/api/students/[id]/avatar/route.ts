import { auth } from "@/auth";
import { createAccessTokenForSession } from "@/lib/access-token";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const backendUrl = () => process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

async function proxyAvatar(request: NextRequest, studentId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = await createAccessTokenForSession(session);
  const target = new URL(`/api/students/${studentId}/avatar${request.nextUrl.search}`, backendUrl());

  const response = await fetch(target, {
    method: request.method,
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (!response.ok) {
    return new Response(response.statusText, { status: response.status });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "no-cache"
    }
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyAvatar(request, id);
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyAvatar(request, id);
}
