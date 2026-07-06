import { SignJWT } from "jose";
import type { Session } from "next-auth";

export async function createAccessTokenForSession(session: Session): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return new SignJWT({
    email: session.user.email,
    plan: session.user.plan
  })
    .setSubject(session.user.id)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}
