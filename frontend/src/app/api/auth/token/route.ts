import { auth } from "@/auth";
import { SignJWT } from "jose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "AUTH_SECRET is not configured" }, { status: 500 });
  }

  const token = await new SignJWT({
    email: session.user.email,
    plan: session.user.plan
  })
    .setSubject(session.user.id)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));

  return Response.json({ token });
}
