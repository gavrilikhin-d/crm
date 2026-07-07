CREATE SCHEMA IF NOT EXISTS analytics;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.accounts AS
SELECT
  id,
  email,
  name,
  image,
  plan,
  google_calendar_sync_enabled,
  created_at,
  updated_at
FROM public.accounts;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.students AS
SELECT
  id,
  account_id,
  full_name,
  avatar_url,
  telegram_username,
  telegram_user_id,
  telegram_chat_id,
  lesson_reminder_minutes,
  status,
  default_lesson_price,
  created_at,
  updated_at
FROM public.students;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.lessons AS
SELECT
  id,
  account_id,
  starts_at,
  duration_minutes,
  original_type,
  effective_type,
  status,
  recurring_schedule_id,
  google_calendar_event_id,
  created_at,
  updated_at
FROM public.lessons;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.lesson_participants AS
SELECT
  id,
  lesson_id,
  student_id,
  status,
  balance_charged,
  has_debt
FROM public.lesson_participants;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.payments AS
SELECT
  id,
  account_id,
  student_id,
  amount,
  currency,
  paid_at,
  method,
  package_id,
  lesson_count,
  created_at
FROM public.payments;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.lesson_packages AS
SELECT
  id,
  account_id,
  name,
  lesson_count,
  price,
  currency,
  active,
  created_at,
  updated_at
FROM public.lesson_packages;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.recurring_schedules AS
SELECT
  id,
  account_id,
  weekday,
  time,
  duration_minutes,
  lesson_type,
  active_from,
  active_to,
  created_at,
  updated_at
FROM public.recurring_schedules;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.recurring_schedule_students AS
SELECT
  schedule_id,
  student_id
FROM public.recurring_schedule_students;--> statement-breakpoint
CREATE OR REPLACE VIEW analytics.balance_adjustments AS
SELECT
  id,
  account_id,
  student_id,
  lesson_delta,
  reason,
  created_at
FROM public.balance_adjustments;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_readonly') THEN
    CREATE ROLE metabase_readonly NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA analytics TO metabase_readonly;--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO metabase_readonly;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO metabase_readonly;
