import postgres from "postgres";

const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgres://crm:crm@localhost:55432/crm_e2e";
const target = new URL(databaseUrl);
const databaseName = target.pathname.replace(/^\//, "");

if (!databaseName) {
  throw new Error(`E2E_DATABASE_URL is missing a database name: ${databaseUrl}`);
}

const adminUrl = new URL(target);
adminUrl.pathname = "/postgres";

let sql: ReturnType<typeof postgres> | undefined;

try {
  sql = await connectWithRetry(adminUrl.toString());
  const existing = await sql`select 1 from pg_database where datname = ${databaseName}`;

  if (!existing.length) {
    await sql.unsafe(`create database ${quoteIdentifier(databaseName)}`);
    console.log(`Created e2e database "${databaseName}".`);
  } else {
    console.log(`E2E database "${databaseName}" already exists.`);
  }
} finally {
  await sql?.end();
}

async function connectWithRetry(url: string): Promise<ReturnType<typeof postgres>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const candidate = postgres(url, { max: 1 });
    try {
      await candidate`select 1`;
      return candidate;
    } catch (error) {
      lastError = error;
      await candidate.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Postgres did not become ready for e2e setup.");
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
