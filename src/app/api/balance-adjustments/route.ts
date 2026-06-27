import { jsonError, jsonOk, requireFields } from "../_helpers";
import { store } from "../../../store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireFields(body, ["studentId", "lessonDelta", "reason"]);
    return jsonOk(await store.createAdjustment(body), 201);
  } catch (error) {
    return jsonError(error);
  }
}
