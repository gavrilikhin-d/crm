import { jsonError, jsonOk } from "../../_helpers";
import { store } from "../../../../store";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await store.deleteLessonPackage(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
