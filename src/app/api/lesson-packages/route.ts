import { jsonError, jsonOk, requireFields } from "../_helpers";
import { store } from "../../../store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireFields(body, ["name", "lessonCount", "price"]);
    return jsonOk(await store.createLessonPackage(body), 201);
  } catch (error) {
    return jsonError(error);
  }
}
