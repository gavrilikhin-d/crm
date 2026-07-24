import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  googleSub: text("google_sub").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarTokenExpiresAt: timestamp("google_calendar_token_expires_at", {
    withTimezone: true,
    mode: "string"
  }),
  googleCalendarId: text("google_calendar_id").notNull().default("primary"),
  googleCalendarSyncEnabled: boolean("google_calendar_sync_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const students = pgTable(
  "students",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    avatarUrl: text("avatar_url"),
    telegramUsername: text("telegram_username"),
    telegramUserId: text("telegram_user_id"),
    telegramChatId: text("telegram_chat_id"),
    telegramBindToken: text("telegram_bind_token").notNull(),
    lessonReminderMinutes: jsonb("lesson_reminder_minutes").$type<number[] | null>(),
    timezone: text("timezone"),
    status: text("status").notNull(),
    defaultLessonPrice: integer("default_lesson_price").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
  },
  (table) => [
    uniqueIndex("students_account_telegram_user_idx").on(table.accountId, table.telegramUserId)
  ]
);

export const lessonPackages = pgTable("lesson_packages", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lessonCount: integer("lesson_count").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("BYN"),
  active: boolean("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const recurringSchedules = pgTable("recurring_schedules", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  time: text("time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  lessonType: text("lesson_type").notNull(),
  activeFrom: timestamp("active_from", { withTimezone: true, mode: "string" }).notNull(),
  activeTo: timestamp("active_to", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const recurringScheduleStudents = pgTable(
  "recurring_schedule_students",
  {
    scheduleId: text("schedule_id").notNull(),
    studentId: text("student_id").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.scheduleId, table.studentId] }),
    foreignKey({
      name: "rec_sched_students_schedule_fk",
      columns: [table.scheduleId],
      foreignColumns: [recurringSchedules.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "rec_sched_students_student_fk",
      columns: [table.studentId],
      foreignColumns: [students.id]
    }).onDelete("cascade")
  ]
);

export const recurringSkippedOccurrences = pgTable(
  "recurring_skipped_occurrences",
  {
    scheduleId: text("schedule_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.scheduleId, table.startsAt] }),
    foreignKey({
      name: "rec_skipped_schedule_fk",
      columns: [table.scheduleId],
      foreignColumns: [recurringSchedules.id]
    }).onDelete("cascade")
  ]
);

export const lessons = pgTable("lessons", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  originalType: text("original_type").notNull(),
  effectiveType: text("effective_type").notNull(),
  status: text("status").notNull(),
  recurringScheduleId: text("recurring_schedule_id").references(() => recurringSchedules.id, {
    onDelete: "set null"
  }),
  googleCalendarEventId: text("google_calendar_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const lessonParticipants = pgTable("lesson_participants", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  balanceCharged: boolean("balance_charged").notNull(),
  hasDebt: boolean("has_debt").notNull()
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("BYN"),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }).notNull(),
  method: text("method").notNull(),
  packageId: text("package_id").references(() => lessonPackages.id, { onDelete: "set null" }),
  lessonCount: integer("lesson_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
});

export const reminders = pgTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    lessonId: text("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
    studentId: text("student_id").references(() => students.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "string" }).notNull(),
    status: text("status").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    error: text("error"),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "string" }),
    leadMinutes: integer("lead_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
  },
  (table) => [
    index("reminders_pending_scheduled_for_idx")
      .on(table.scheduledFor)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex("reminders_lesson_unique_idx")
      .on(table.lessonId, table.studentId, table.leadMinutes)
      .where(sql`${table.type} = 'lesson'`),
    uniqueIndex("reminders_payment_day_unique_idx")
      .on(table.studentId, sql`((timezone('UTC', ${table.scheduledFor}))::date)`)
      .where(sql`${table.type} = 'payment'`)
  ]
);

export const telegramInteractions = pgTable("telegram_interactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
});

export const balanceAdjustments = pgTable("balance_adjustments", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  lessonDelta: integer("lesson_delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
});

export const appSettings = pgTable("app_settings", {
  accountId: text("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  lessonReminderMinutes: jsonb("lesson_reminder_minutes").$type<number[]>().notNull(),
  individualDurationMinutes: integer("individual_duration_minutes").notNull(),
  groupDurationMinutes: integer("group_duration_minutes").notNull(),
  defaultSingleLessonPrice: integer("default_single_lesson_price").notNull(),
  currency: text("currency").notNull(),
  cancellationPolicy: text("cancellation_policy").notNull(),
  timezone: text("timezone").notNull().default("Europe/Minsk")
});

export const vacationPeriods = pgTable("vacation_periods", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  startsAtTime: text("starts_at_time"),
  endsAtTime: text("ends_at_time"),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    actorType: text("actor_type").notNull(),
    actorStudentId: text("actor_student_id").references(() => students.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
  },
  (table) => [
    index("activity_events_account_created_idx").on(table.accountId, table.createdAt),
    index("activity_events_action_created_idx").on(table.action, table.createdAt)
  ]
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    studentId: text("student_id").references(() => students.id, { onDelete: "set null" }),
    lessonId: text("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    reminderId: text("reminder_id").references(() => reminders.id, { onDelete: "set null" }),
    channel: text("channel").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    leadMinutes: integer("lead_minutes"),
    telegramChatId: text("telegram_chat_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
  },
  (table) => [
    index("notification_deliveries_account_created_idx").on(table.accountId, table.createdAt),
    index("notification_deliveries_reminder_idx").on(table.reminderId)
  ]
);
