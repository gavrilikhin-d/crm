import { jwtVerify } from "jose";
import type { IncomingMessage } from "node:http";
import type { AccountPlan } from "@crm/shared";

export type AuthContext = {
  accountId: string;
  email: string;
  plan: AccountPlan;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyAccessToken(token: string): Promise<AuthContext> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"]
  });

  const accountId = typeof payload.sub === "string" ? payload.sub : undefined;
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const plan = typeof payload.plan === "string" ? (payload.plan as AccountPlan) : undefined;

  if (!accountId || !email || !plan) {
    throw new Error("Invalid token payload");
  }

  return { accountId, email, plan };
}

export function readBearerToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}

export function readInternalToken(request: IncomingMessage): string | null {
  return readBearerToken(request);
}

export function assertInternalToken(request: IncomingMessage): void {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    throw new Error("INTERNAL_API_TOKEN is not configured");
  }

  const token = readInternalToken(request);
  if (token !== expected) {
    throw new Error("Unauthorized");
  }
}

function authSyncSecret(): string {
  const syncSecret = process.env.AUTH_SYNC_SECRET?.trim();
  if (syncSecret) {
    return syncSecret;
  }

  const authSecret = process.env.AUTH_SECRET?.trim();
  if (authSecret) {
    return authSecret;
  }

  throw new Error("AUTH_SYNC_SECRET is not configured");
}

export function assertAuthSyncSecret(request: IncomingMessage): void {
  const expected = authSyncSecret();

  const token = readBearerToken(request);
  if (token !== expected) {
    throw new Error("Unauthorized");
  }
}

export async function authenticateRequest(request: IncomingMessage): Promise<AuthContext> {
  const token = readBearerToken(request);
  if (!token) {
    throw new Error("Unauthorized");
  }
  return verifyAccessToken(token);
}
