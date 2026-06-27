import { jsonError, jsonOk } from "../_helpers";
import { store } from "../../../store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [snapshot, balances, dashboard] = await Promise.all([
      store.getSnapshot(),
      store.getBalances(),
      store.getDashboard()
    ]);
    return jsonOk({ ...snapshot, balances, dashboard });
  } catch (error) {
    return jsonError(error);
  }
}
