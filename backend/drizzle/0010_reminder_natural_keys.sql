ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "lead_minutes" integer;--> statement-breakpoint
UPDATE "reminders"
SET "lead_minutes" = (regexp_match("dedupe_key", '^lesson:[^:]+:[^:]+:(\d+)$'))[1]::integer
WHERE "type" = 'lesson'
  AND "lead_minutes" IS NULL
  AND "dedupe_key" IS NOT NULL;--> statement-breakpoint
DROP VIEW IF EXISTS analytics.reminders;--> statement-breakpoint
ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_dedupe_key_unique";--> statement-breakpoint
ALTER TABLE "reminders" DROP COLUMN IF EXISTS "dedupe_key";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reminders_lesson_unique_idx" ON "reminders" USING btree ("lesson_id","student_id","lead_minutes") WHERE "type" = 'lesson';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reminders_payment_day_unique_idx" ON "reminders" USING btree ("student_id",((timezone('UTC', "scheduled_for"))::date)) WHERE "type" = 'payment';--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.reminders AS
SELECT
  id,
  account_id,
  type,
  lesson_id,
  student_id,
  scheduled_for,
  status,
  sent_at,
  error,
  claimed_at,
  lead_minutes,
  created_at
FROM public.reminders;--> statement-breakpoint
GRANT SELECT ON analytics.reminders TO metabase_readonly;
