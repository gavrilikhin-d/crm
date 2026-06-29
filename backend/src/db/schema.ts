import { boolean, foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  googleSub: text("google_sub").notNull().unique(),
  plan: text("plan").notNull().default("free"),
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
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }).notNull(),
  method: text("method").notNull(),
  packageId: text("package_id").references(() => lessonPackages.id, { onDelete: "set null" }),
  lessonCount: integer("lesson_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
});

export const reminders = pgTable("reminders", {
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
  dedupeKey: text("dedupe_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull()
});

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
  cancellationPolicy: text("cancellation_policy").notNull()
});
