import { jsonError, jsonOk, requireFields } from "../../../../../_helpers";
import { store } from "../../../../../../../store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const { id, studentId } = await params;
    const body = await request.json();
    requireFields(body, ["status"]);
    return jsonOk(await store.setParticipantStatus(id, studentId, body.status));
  } catch (error) {
    return jsonError(error);
  }
}
