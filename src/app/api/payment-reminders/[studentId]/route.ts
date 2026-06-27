import { jsonError, jsonOk } from "../../_helpers";
import { sendManualPaymentReminder } from "../../../../reminders";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
    const result = await sendManualPaymentReminder(studentId);
    return jsonOk({ ok: true, ...result }, 202);
  } catch (error) {
    return jsonError(error);
  }
}
