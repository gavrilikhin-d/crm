import { jsonError, jsonOk } from "../../_helpers";
import { store } from "../../../../store";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    return jsonOk(await store.updateStudent(id, body));
  } catch (error) {
    return jsonError(error);
  }
}
