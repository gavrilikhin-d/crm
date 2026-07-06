import { describe, expect, test } from "bun:test";
import { SignJWT } from "jose";
import type { IncomingMessage } from "node:http";
import { eq } from "drizzle-orm";
import { authenticateRequest } from "./auth";
import { db } from "./db/client";
import { accounts } from "./db/schema";
import { createTestAccount, isDatabaseAvailable } from "./test/fixtures";

const databaseAvailable = await isDatabaseAvailable();
const authSecret = process.env.AUTH_SECRET;

function mockRequest(token: string): IncomingMessage {
  return {
    headers: {
      authorization: `Bearer ${token}`
    }
  } as IncomingMessage;
}

async function signAccessToken(accountId: string, email: string, plan: string): Promise<string> {
  if (!authSecret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return new SignJWT({ email, plan })
    .setSubject(accountId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(authSecret));
}

describe.skipIf(!databaseAvailable || !authSecret)("authenticateRequest", () => {
  test("rejects tokens for deleted accounts", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const token = await signAccessToken(ctx.accountId, ctx.email, ctx.plan);
      const authenticated = await authenticateRequest(mockRequest(token));
      expect(authenticated.accountId).toBe(ctx.accountId);

      await db.delete(accounts).where(eq(accounts.id, ctx.accountId));

      await expect(authenticateRequest(mockRequest(token))).rejects.toThrow("Unauthorized");
    } finally {
      await cleanup();
    }
  });
});
