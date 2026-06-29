import type { AccountPlan } from "@crm/shared";
import { getPlanLimits } from "@crm/shared/plans";
import {
  countActiveStudents,
  countLessonsInMonth,
  countPackages,
  countRecurringSchedules
} from "./db/repository";

export class PlanLimitError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PlanLimitError";
    this.code = code;
  }
}

function monthBounds(date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export async function getAccountUsage(accountId: string) {
  const { start, end } = monthBounds();
  const [students, lessonsThisMonth, packages, recurringSchedules] = await Promise.all([
    countActiveStudents(accountId),
    countLessonsInMonth(accountId, start, end),
    countPackages(accountId),
    countRecurringSchedules(accountId)
  ]);

  return { students, lessonsThisMonth, packages, recurringSchedules };
}

export async function assertCanCreateStudent(accountId: string, plan: AccountPlan): Promise<void> {
  const limits = getPlanLimits(plan);
  if (limits.maxStudents === null) {
    return;
  }

  const count = await countActiveStudents(accountId);
  if (count >= limits.maxStudents) {
    throw new PlanLimitError("student_limit", `Student limit reached (${limits.maxStudents})`);
  }
}

export async function assertCanCreateLesson(
  accountId: string,
  plan: AccountPlan,
  options?: { repeatWeekly?: boolean; additionalLessons?: number }
): Promise<void> {
  const limits = getPlanLimits(plan);

  if (options?.repeatWeekly && !limits.recurringEnabled) {
    throw new PlanLimitError("recurring_disabled", "Recurring lessons are not available on the free plan");
  }

  if (limits.maxLessonsPerMonth === null) {
    return;
  }

  const { start, end } = monthBounds();
  const current = await countLessonsInMonth(accountId, start, end);
  const additional = options?.additionalLessons ?? 1;
  if (current + additional > limits.maxLessonsPerMonth) {
    throw new PlanLimitError(
      "lesson_limit",
      `Monthly lesson limit reached (${limits.maxLessonsPerMonth})`
    );
  }
}

export async function assertCanCreatePackage(accountId: string, plan: AccountPlan): Promise<void> {
  const limits = getPlanLimits(plan);
  if (limits.maxPackages === null) {
    return;
  }

  const count = await countPackages(accountId);
  if (count >= limits.maxPackages) {
    throw new PlanLimitError("package_limit", `Package limit reached (${limits.maxPackages})`);
  }
}
