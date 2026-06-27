import { jsonError, jsonOk } from "../_helpers";
import { store } from "../../../store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await store.getDashboard());
  } catch (error) {
    return jsonError(error);
  }
}
