import { auth } from "@/auth";
import { createAccessTokenForSession } from "@/lib/access-token";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await createAccessTokenForSession(session);

  return Response.json({ token });
}
