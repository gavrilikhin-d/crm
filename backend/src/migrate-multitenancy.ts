import "dotenv/config";
import { nanoid } from "nanoid";
import postgres from "postgres";
import { createDefaultSettings } from "./store-logic";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://crm:crm@localhost:5432/crm";

const pg = postgres(connectionString, { max: 1 });

async function main() {
  console.log("Starting multi-tenancy migration...");

  await pg`CREATE TABLE IF NOT EXISTS accounts (
    id text PRIMARY KEY NOT NULL,
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    image text,
    google_sub text NOT NULL UNIQUE,
    plan text DEFAULT 'free' NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )`;

  const tenantTables = [
    "students",
    "lesson_packages",
    "recurring_schedules",
    "lessons",
    "payments",
    "reminders",
    "telegram_interactions",
    "balance_adjustments"
  ] as const;

  for (const table of tenantTables) {
    await pg.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS account_id text`);
  }

  await pg`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS account_id text`;

  const appSettingsHasId = await columnExists("app_settings", "id");
  const appSettingsAccountIsPk = await isPrimaryKey("app_settings", "account_id");

  const existingAccounts = await pg<{ count: string }[]>`
    SELECT count(*)::text AS count FROM accounts
  `;
  const accountCount = Number(existingAccounts[0]?.count ?? 0);

  let legacyAccountId: string | null = null;

  if (accountCount === 0) {
    legacyAccountId = nanoid();
    const timestamp = new Date().toISOString();
    await pg`
      INSERT INTO accounts (id, email, name, image, google_sub, plan, created_at, updated_at)
      VALUES (
        ${legacyAccountId},
        ${"legacy@local.crm"},
        ${"Legacy Account"},
        ${null},
        ${`legacy-${legacyAccountId}`},
        ${"standard"},
        ${timestamp},
        ${timestamp}
      )
    `;
    console.log(`Created legacy account ${legacyAccountId}`);
  } else if (accountCount === 1) {
    const rows = await pg<{ id: string }[]>`SELECT id FROM accounts LIMIT 1`;
    legacyAccountId = rows[0]?.id ?? null;
    console.log(`Using existing account ${legacyAccountId}`);
  } else {
    console.log("Multiple accounts already exist — skipping data assignment.");
  }

  if (legacyAccountId) {
    for (const table of tenantTables) {
      await pg.unsafe(`
        UPDATE ${table}
        SET account_id = $1
        WHERE account_id IS NULL OR account_id = ''
      `, [legacyAccountId]);
    }

    if (appSettingsHasId && !appSettingsAccountIsPk) {
      const settingsRows = await pg<
        Array<{
          id: string;
          lesson_reminder_minutes: number[];
          individual_duration_minutes: number;
          group_duration_minutes: number;
          default_single_lesson_price: number;
          currency: string;
          cancellation_policy: string;
          account_id: string | null;
        }>
      >`SELECT * FROM app_settings LIMIT 1`;

      const row = settingsRows[0];
      if (row) {
        await pg`
          UPDATE app_settings
          SET account_id = ${legacyAccountId}
          WHERE id = ${row.id}
        `;
      }
    } else if (!appSettingsAccountIsPk) {
      const settingsRows = await pg<{ account_id: string | null }[]>`
        SELECT account_id FROM app_settings LIMIT 1
      `;
      if (!settingsRows[0]?.account_id) {
        const defaults = createDefaultSettings();
        await pg`
          INSERT INTO app_settings (
            account_id,
            lesson_reminder_minutes,
            individual_duration_minutes,
            group_duration_minutes,
            default_single_lesson_price,
            currency,
            cancellation_policy
          ) VALUES (
            ${legacyAccountId},
            ${JSON.stringify(defaults.lessonReminderMinutes)},
            ${defaults.individualDurationMinutes},
            ${defaults.groupDurationMinutes},
            ${defaults.defaultSingleLessonPrice},
            ${defaults.currency},
            ${defaults.cancellationPolicy}
          )
        `;
      }
    }
  }

  for (const table of tenantTables) {
    await pg.unsafe(`ALTER TABLE ${table} ALTER COLUMN account_id SET NOT NULL`);
    await ensureForeignKey(
      table,
      `${table}_account_id_accounts_id_fk`,
      `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE`
    );
  }

  if (appSettingsHasId && !appSettingsAccountIsPk) {
    await pg`ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey`;
    await pg`ALTER TABLE app_settings DROP COLUMN IF EXISTS id`;
  }

  await pg`ALTER TABLE app_settings ALTER COLUMN account_id SET NOT NULL`;

  if (!appSettingsAccountIsPk) {
    await pg`ALTER TABLE app_settings ADD PRIMARY KEY (account_id)`;
  }

  await ensureForeignKey(
    "app_settings",
    "app_settings_account_id_accounts_id_fk",
    "FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE"
  );

  await pg`
    CREATE UNIQUE INDEX IF NOT EXISTS students_account_telegram_user_idx
    ON students (account_id, telegram_user_id)
  `;

  console.log("Multi-tenancy migration completed.");
  console.log("You can now run `bun run db:push` to sync any remaining schema details.");
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await pg<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

async function isPrimaryKey(table: string, column: string): Promise<boolean> {
  const rows = await pg<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = ${table}
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name = ${column}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

async function ensureForeignKey(table: string, constraintName: string, definition: string): Promise<void> {
  const rows = await pg<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND constraint_name = ${constraintName}
    ) AS exists
  `;

  if (!rows[0]?.exists) {
    await pg.unsafe(`ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} ${definition}`);
  }
}

void main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pg.end();
  });
