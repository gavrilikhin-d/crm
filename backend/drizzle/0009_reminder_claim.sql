ALTER TABLE "reminders" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "reminders_pending_scheduled_for_idx" ON "reminders" USING btree ("scheduled_for") WHERE "status" = 'pending';
