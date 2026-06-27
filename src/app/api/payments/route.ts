import { jsonError, jsonOk, requireFields } from "../_helpers";
import { store } from "../../../store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireFields(body, ["studentId", "method"]);
    return jsonOk(await store.createPayment(body), 201);
  } catch (error) {
    return jsonError(error);
  }
}
