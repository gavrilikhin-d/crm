export type StudentStatus = "active" | "inactive";

export type LessonType = "individual" | "group";

export type LessonStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled_by_student"
  | "cancelled_by_teacher"
  | "completed"
  | "missed";

export type ParticipantStatus =
  | "awaiting"
  | "confirmed"
  | "declined"
  | "missed"
  | "attended";

export type ReminderType = "lesson" | "payment";

export type ReminderStatus = "pending" | "sent" | "skipped" | "failed";

export type PaymentMethod = "cash" | "transfer" | "other";

export type RecurringDeleteScope = "single" | "following" | "all";

export type AccountPlan = "free" | "standard" | "premium";

export interface Account {
  id: string;
  email: string;
  name: string;
  image?: string;
  plan: AccountPlan;
  createdAt: string;
  updatedAt: string;
}

export type AccountUsage = {
  students: number;
  lessonsThisMonth: number;
  packages: number;
  recurringSchedules: number;
};

export type AccountInfo = {
  account: Account;
  usage: AccountUsage;
  limits: import("./plans").PlanLimits;
};

export interface Student {
  id: string;
  fullName: string;
  avatarUrl?: string;
  telegramUsername?: string;
  telegramUserId?: string;
  telegramChatId?: string;
  telegramBindToken: string;
  lessonReminderMinutes?: number[] | null;
  timezone?: string | null;
  status: StudentStatus;
  defaultLessonPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonPackage {
  id: string;
  name: string;
  lessonCount: number;
  price: number;
  currency: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LessonParticipant {
  id: string;
  studentId: string;
  status: ParticipantStatus;
  balanceCharged: boolean;
  hasDebt: boolean;
}

export interface Lesson {
  id: string;
  startsAt: string;
  durationMinutes: number;
  originalType: LessonType;
  effectiveType: LessonType;
  status: LessonStatus;
  participants: LessonParticipant[];
  recurringScheduleId?: string;
  googleCalendarEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export type GoogleCalendarStatus = {
  connected: boolean;
  syncEnabled: boolean;
  calendarId: string;
};

export interface RecurringSchedule {
  id: string;
  weekday: number;
  time: string;
  durationMinutes: number;
  lessonType: LessonType;
  studentIds: string[];
  activeFrom: string;
  activeTo?: string;
  skippedOccurrences?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  currency: string;
  paidAt: string;
  method: PaymentMethod;
  packageId?: string;
  lessonCount: number;
  createdAt: string;
}

export interface Reminder {
  id: string;
  type: ReminderType;
  lessonId?: string;
  studentId?: string;
  scheduledFor: string;
  status: ReminderStatus;
  sentAt?: string;
  error?: string;
  claimedAt?: string;
  leadMinutes?: number;
  createdAt: string;
}

export interface TelegramInteraction {
  id: string;
  lessonId: string;
  studentId: string;
  action: "attend" | "decline";
  createdAt: string;
}

export interface BalanceAdjustment {
  id: string;
  studentId: string;
  lessonDelta: number;
  reason: string;
  createdAt: string;
}

export interface VacationPeriod {
  id: string;
  startsOn: string;
  endsOn: string;
  startsAtTime?: string;
  endsAtTime?: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  lessonReminderMinutes: number[];
  individualDurationMinutes: number;
  groupDurationMinutes: number;
  defaultSingleLessonPrice: number;
  currency: string;
  cancellationPolicy: "free" | "paid";
  timezone: string;
}

export interface Database {
  students: Student[];
  lessonPackages: LessonPackage[];
  lessons: Lesson[];
  recurringSchedules: RecurringSchedule[];
  payments: Payment[];
  reminders: Reminder[];
  telegramInteractions: TelegramInteraction[];
  balanceAdjustments: BalanceAdjustment[];
  vacationPeriods: VacationPeriod[];
  settings: AppSettings;
}

export interface StudentBalance {
  studentId: string;
  paidLessons: number;
  chargedLessons: number;
  remainingLessons: number;
  debtLessons: number;
}

export interface TelegramTeacherContext {
  studentId: string;
  accountId: string;
  name: string;
}

export interface TelegramStudentProfile {
  student: {
    id: string;
    fullName: string;
    lessonReminderMinutes?: number[] | null;
    timezone?: string | null;
  };
  teacher: TelegramTeacherContext;
  teachers: TelegramTeacherContext[];
  settings: Pick<AppSettings, "lessonReminderMinutes" | "timezone">;
  balance: StudentBalance;
  upcomingLessons: Lesson[];
  scheduleDays: number;
}
