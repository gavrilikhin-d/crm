ALTER TABLE "app_settings" ADD COLUMN "timezone" text DEFAULT 'Europe/Minsk' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "timezone" text;
