import { jsonError, jsonOk, requireFields } from "../_helpers";
import { store } from "../../../store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireFields(body, ["startsAt", "lessonType", "studentIds"]);
    return jsonOk(await store.createLesson(body), 201);
  } catch (error) {
    return jsonError(error);
  }
}
