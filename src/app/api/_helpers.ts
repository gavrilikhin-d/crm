import { NextResponse } from "next/server";

export function jsonOk<T>(payload: T, status = 200): NextResponse<T> {
  return NextResponse.json(payload, { status });
}

export function jsonError(error: unknown): NextResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("not found") ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

export function requireFields(body: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}
