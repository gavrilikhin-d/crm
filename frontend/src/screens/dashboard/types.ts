import type { AccountInfo, Database, Lesson, Student, StudentBalance } from "@crm/shared";

export type Snapshot = Database & {
  balances: StudentBalance[];
  account?: AccountInfo;
  dashboard: {
    upcomingLessons: Lesson[];
    debtors: Array<{ student: Student; balance: StudentBalance }>;
    studentsCount: number;
    lessonsCount: number;
  };
};

export type ActiveSection = "schedule" | "clients" | "payments" | "sessions" | "settings";
export type ScheduleView = "day" | "week" | "month";
export type ActiveModal = "student" | "payment" | "package" | null;

export type CalendarRange = {
  startHour: number;
  endHour: number;
  hours: number[];
};
