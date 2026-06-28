import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Database } from "@crm/shared";
import { importDatabase } from "./db/repository";

const dbPath = process.env.DATA_FILE_PATH ?? join(process.cwd(), "data", "db.json");

const raw = await readFile(dbPath, "utf8");
const snapshot = JSON.parse(raw) as Database;

if (!snapshot.recurringSchedules) {
  snapshot.recurringSchedules = [];
}

await importDatabase(snapshot);
console.log(`Imported ${dbPath} into PostgreSQL`);
