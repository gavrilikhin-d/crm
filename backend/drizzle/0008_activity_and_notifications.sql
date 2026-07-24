CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_student_id" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"student_id" text,
	"lesson_id" text,
	"reminder_id" text,
	"channel" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"lead_minutes" integer,
	"telegram_chat_id" text,
	"error" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_student_id_students_id_fk" FOREIGN KEY ("actor_student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_account_created_idx" ON "activity_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_action_created_idx" ON "activity_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_account_created_idx" ON "notification_deliveries" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_reminder_idx" ON "notification_deliveries" USING btree ("reminder_id");--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS analytics;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_readonly') THEN
    CREATE ROLE metabase_readonly NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.activity_events AS
SELECT
  id,
  account_id,
  actor_type,
  actor_student_id,
  action,
  entity_type,
  entity_id,
  metadata,
  created_at
FROM public.activity_events;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.notification_deliveries AS
SELECT
  id,
  account_id,
  student_id,
  lesson_id,
  reminder_id,
  channel,
  type,
  status,
  lead_minutes,
  telegram_chat_id,
  error,
  created_at
FROM public.notification_deliveries;--> statement-breakpoint
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
  dedupe_key,
  created_at
FROM public.reminders;--> statement-breakpoint
GRANT USAGE ON SCHEMA analytics TO metabase_readonly;--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO metabase_readonly;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO metabase_readonly;