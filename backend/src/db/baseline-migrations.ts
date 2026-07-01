import "../load-env.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const migrationsDir = path.resolve(import.meta.dirname, "../../drizzle");
const journalPath = path.join(migrationsDir, "meta/_journal.json");

type JournalEntry = {
  tag: string;
  when: number;
};

function readJournal(): JournalEntry[] {
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: JournalEntry[] };
  return journal.entries;
}

function migrationHash(tag: string): string {
  const sql = fs.readFileSync(path.join(migrationsDir, `${tag}.sql`), "utf8");
  return crypto.createHash("sha256").update(sql).digest("hex");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const entries = readJournal();

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const applied = await sql<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations
  `;
  const appliedHashes = new Set(applied.map((row) => row.hash));

  let inserted = 0;
  for (const entry of entries) {
    const hash = migrationHash(entry.tag);
    if (appliedHashes.has(hash)) {
      console.log(`skip ${entry.tag} (already recorded)`);
      continue;
    }

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`baseline ${entry.tag}`);
    inserted += 1;
  }

  await sql.end();

  if (inserted === 0) {
    console.log("Nothing to baseline — all journal migrations are already recorded.");
  } else {
    console.log(`Baselined ${inserted} migration(s). You can now run: bun run db:migrate`);
  }
}

await main();
