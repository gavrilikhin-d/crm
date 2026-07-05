ALTER TABLE "lesson_packages" ADD COLUMN "currency" text DEFAULT 'BYN' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" text DEFAULT 'BYN' NOT NULL;
