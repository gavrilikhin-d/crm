import { SignJWT, jwtVerify } from "jose";

const PURPOSE = "google-calendar";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createGoogleCalendarOAuthState(accountId: string): Promise<string> {
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function verifyGoogleCalendarOAuthState(state: string): Promise<string> {
  const { payload } = await jwtVerify(state, getSecret(), {
    algorithms: ["HS256"]
  });

  if (payload.purpose !== PURPOSE) {
    throw new Error("Invalid OAuth state");
  }

  const accountId = typeof payload.sub === "string" ? payload.sub : undefined;
  if (!accountId) {
    throw new Error("Invalid OAuth state");
  }

  return accountId;
}
