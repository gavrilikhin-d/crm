CREATE TABLE "vacation_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"starts_at_time" text,
	"ends_at_time" text,
	"label" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "google_calendar_refresh_token" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "google_calendar_access_token" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "google_calendar_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "google_calendar_id" text DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "google_calendar_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "google_calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "vacation_periods" ADD CONSTRAINT "vacation_periods_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;