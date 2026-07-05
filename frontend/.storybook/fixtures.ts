import type {
  AccountInfo,
  AppSettings,
  Lesson,
  LessonPackage,
  Payment,
  RecurringSchedule,
  Student,
  StudentBalance,
  VacationPeriod
} from "@crm/shared";
import { PLAN_LIMITS } from "@crm/shared/plans";
import type { CurrencyCode } from "@crm/shared/currency";
import type { CalendarRange, Snapshot } from "../src/screens/dashboard/types";

const storyNow = new Date("2024-04-01T12:00:00.000Z");
const selectedDate = new Date("2024-04-01T00:00:00.000Z");
const timestamp = "2024-04-01T12:00:00.000Z";

const students: Student[] = [
  {
    id: "student-anna",
    fullName: "Анна Петрова",
    telegramUsername: "anna_voice",
    telegramUserId: "telegram-anna",
    telegramChatId: "chat-anna",
    telegramBindToken: "bind-anna",
    status: "active",
    defaultLessonPrice: 3500,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "student-ivan",
    fullName: "Иван Смирнов",
    telegramBindToken: "bind-ivan",
    status: "active",
    defaultLessonPrice: 3000,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "student-maria",
    fullName: "Мария Соколова",
    telegramBindToken: "bind-maria",
    status: "inactive",
    defaultLessonPrice: 3200,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const lessonPackages: LessonPackage[] = [
  {
    id: "package-basic",
    name: "Абонемент 4 занятия",
    lessonCount: 4,
    price: 12000,
    currency: "BYN",
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "package-pro",
    name: "Абонемент 8 занятий",
    lessonCount: 8,
    price: 22000,
    currency: "BYN",
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const lessons: Lesson[] = [
  {
    id: "lesson-1",
    startsAt: "2024-04-01T10:00:00.000Z",
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: "scheduled",
    participants: [
      {
        id: "participant-1",
        studentId: "student-anna",
        status: "confirmed",
        balanceCharged: false,
        hasDebt: false
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "lesson-2",
    startsAt: "2024-04-02T15:00:00.000Z",
    durationMinutes: 90,
    originalType: "group",
    effectiveType: "group",
    status: "confirmed",
    recurringScheduleId: "recurring-1",
    participants: [
      {
        id: "participant-2",
        studentId: "student-anna",
        status: "confirmed",
        balanceCharged: true,
        hasDebt: false
      },
      {
        id: "participant-3",
        studentId: "student-ivan",
        status: "awaiting",
        balanceCharged: true,
        hasDebt: true
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "lesson-3",
    startsAt: "2024-04-05T17:30:00.000Z",
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: "completed",
    participants: [
      {
        id: "participant-4",
        studentId: "student-ivan",
        status: "attended",
        balanceCharged: true,
        hasDebt: false
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const recurringSchedules: RecurringSchedule[] = [
  {
    id: "recurring-1",
    weekday: 2,
    time: "15:00",
    durationMinutes: 90,
    lessonType: "group",
    studentIds: ["student-anna", "student-ivan"],
    activeFrom: "2024-04-01",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const payments: Payment[] = [
  {
    id: "payment-1",
    studentId: "student-anna",
    amount: 12000,
    currency: "BYN",
    paidAt: "2024-03-28T09:00:00.000Z",
    method: "transfer",
    packageId: "package-basic",
    lessonCount: 4,
    createdAt: timestamp
  },
  {
    id: "payment-2",
    studentId: "student-deleted",
    amount: 3500,
    currency: "BYN",
    paidAt: "2024-03-30T09:00:00.000Z",
    method: "cash",
    lessonCount: 1,
    createdAt: timestamp
  }
];

const vacationPeriods: VacationPeriod[] = [
  {
    id: "vacation-1",
    startsOn: "2024-04-08",
    endsOn: "2024-04-10",
    label: "Весенний отпуск",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

const balances: StudentBalance[] = [
  {
    studentId: "student-anna",
    paidLessons: 4,
    chargedLessons: 2,
    remainingLessons: 2,
    debtLessons: 0
  },
  {
    studentId: "student-ivan",
    paidLessons: 1,
    chargedLessons: 3,
    remainingLessons: 0,
    debtLessons: 2
  }
];

const settings: AppSettings = {
  lessonReminderMinutes: [1440, 60],
  individualDurationMinutes: 60,
  groupDurationMinutes: 90,
  defaultSingleLessonPrice: 3500,
  currency: "BYN",
  cancellationPolicy: "paid"
};

const accountInfo: AccountInfo = {
  account: {
    id: "account-1",
    email: "teacher@example.com",
    name: "Даниил",
    plan: "premium",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  usage: {
    students: students.length,
    lessonsThisMonth: lessons.length,
    packages: lessonPackages.length,
    recurringSchedules: recurringSchedules.length
  },
  limits: PLAN_LIMITS.premium
};

const calendarRange: CalendarRange = {
  startHour: 8,
  endHour: 20,
  hours: Array.from({ length: 13 }, (_, index) => index + 8)
};

function getStudent(studentId: string): Student | undefined {
  return students.find((student) => student.id === studentId);
}

function makeWeekDays(start = selectedDate): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function makeMonthDays(): Date[] {
  return Array.from({ length: 35 }, (_, index) => {
    const day = new Date("2024-03-25T00:00:00.000Z");
    day.setDate(day.getDate() + index);
    return day;
  });
}

const snapshot: Snapshot = {
  students,
  lessonPackages,
  lessons,
  recurringSchedules,
  payments,
  reminders: [],
  telegramInteractions: [],
  balanceAdjustments: [],
  vacationPeriods,
  settings,
  balances,
  account: accountInfo,
  dashboard: {
    upcomingLessons: lessons,
    debtors: [{ student: students[1], balance: balances[1] }],
    studentsCount: students.length,
    lessonsCount: lessons.length
  }
};

const storybookCurrency: CurrencyCode = "BYN";
const responsiveViewports = [375, 1440];

export {
  accountInfo,
  balances,
  calendarRange,
  getStudent,
  lessonPackages,
  lessons,
  makeMonthDays,
  makeWeekDays,
  payments,
  recurringSchedules,
  responsiveViewports,
  selectedDate,
  settings,
  snapshot,
  storyNow,
  storybookCurrency,
  students,
  timestamp,
  vacationPeriods
};
