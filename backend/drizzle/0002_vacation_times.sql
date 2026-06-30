ALTER TABLE "vacation_periods" ADD COLUMN IF NOT EXISTS "starts_at_time" text;
--> statement-breakpoint
ALTER TABLE "vacation_periods" ADD COLUMN IF NOT EXISTS "ends_at_time" text;
