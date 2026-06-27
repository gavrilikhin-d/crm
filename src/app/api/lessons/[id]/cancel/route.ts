import { jsonError, jsonOk } from "../../../_helpers";
import { store } from "../../../../../store";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return jsonOk(await store.cancelLesson(id));
  } catch (error) {
    return jsonError(error);
  }
}
