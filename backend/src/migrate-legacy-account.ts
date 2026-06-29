import "dotenv/config";
import { nanoid } from "nanoid";
import { db } from "./db/client";
import { accounts } from "./db/schema";
import { assignLegacyDataToAccount } from "./db/repository";

async function main() {
  const accountId = nanoid();
  const timestamp = new Date().toISOString();

  await db.insert(accounts).values({
    id: accountId,
    email: "legacy@local.crm",
    name: "Legacy Account",
    image: null,
    googleSub: `legacy-${accountId}`,
    plan: "standard",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await assignLegacyDataToAccount(accountId);
  console.log(`Assigned legacy data to account ${accountId} (plan: standard)`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
