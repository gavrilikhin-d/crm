const DEFAULT_TEST_DATABASE_URL = "postgres://crm:crm@localhost:5432/crm_test";

const PRODUCTION_HOST_PATTERNS = [
  /\.rds\.amazonaws\.com$/i,
  /\.neon\.tech$/i,
  /\.supabase\.co$/i,
  /\.render\.com$/i,
  /\.railway\.app$/i
];

function resolveTestDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

function assertSafeTestDatabaseUrl(url: string): void {
  const normalized = url.replace(/^postgres(ql)?:\/\//, "https://");
  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid TEST_DATABASE_URL: ${url}`);
  }

  if (PRODUCTION_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    throw new Error(
      `Refusing to run integration tests against production-like host "${parsed.hostname}". ` +
        "Set TEST_DATABASE_URL to a local test database."
    );
  }

  const databaseName = parsed.pathname.replace(/^\//, "").split("?")[0];
  const allowSharedDatabase = process.env.ALLOW_TEST_ON_DATABASE === "1";

  if (databaseName !== "crm_test" && !allowSharedDatabase) {
    throw new Error(
      `Integration tests must use database "crm_test" (current: "${databaseName || "(none)"}"). ` +
        "Create it with: createdb crm_test && cd backend && DATABASE_URL=postgres://crm:crm@localhost:5432/crm_test bun run db:migrate. " +
        "Or set TEST_DATABASE_URL explicitly. To override, set ALLOW_TEST_ON_DATABASE=1."
    );
  }
}

async function prepareTestDatabase(): Promise<void> {
  const url = resolveTestDatabaseUrl();
  assertSafeTestDatabaseUrl(url);
  process.env.DATABASE_URL = url;
}

export { assertSafeTestDatabaseUrl, DEFAULT_TEST_DATABASE_URL, prepareTestDatabase, resolveTestDatabaseUrl };
