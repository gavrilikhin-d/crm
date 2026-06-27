import { jsonOk } from "../_helpers";

export const dynamic = "force-dynamic";

export function GET() {
  return jsonOk({ ok: true });
}
