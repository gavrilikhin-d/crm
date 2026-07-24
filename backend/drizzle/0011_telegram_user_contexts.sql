CREATE TABLE "telegram_user_contexts" (
	"telegram_user_id" text PRIMARY KEY NOT NULL,
	"active_student_id" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_user_contexts" ADD CONSTRAINT "telegram_user_contexts_active_student_id_students_id_fk" FOREIGN KEY ("active_student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
