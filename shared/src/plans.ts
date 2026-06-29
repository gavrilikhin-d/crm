import type { AccountPlan } from "./types";

export type PlanLimits = {
  maxStudents: number | null;
  maxLessonsPerMonth: number | null;
  maxPackages: number | null;
  recurringEnabled: boolean;
};

export type PlanMeta = {
  slug: AccountPlan;
  hasPrioritySupport: boolean;
};

export const PLAN_META: Record<AccountPlan, PlanMeta> = {
  free: { slug: "free", hasPrioritySupport: false },
  standard: { slug: "standard", hasPrioritySupport: false },
  premium: { slug: "premium", hasPrioritySupport: true }
};

export const PLAN_LIMITS: Record<AccountPlan, PlanLimits> = {
  free: {
    maxStudents: 15,
    maxLessonsPerMonth: 50,
    maxPackages: 3,
    recurringEnabled: false
  },
  standard: {
    maxStudents: null,
    maxLessonsPerMonth: null,
    maxPackages: null,
    recurringEnabled: true
  },
  premium: {
    maxStudents: null,
    maxLessonsPerMonth: null,
    maxPackages: null,
    recurringEnabled: true
  }
};

export function getPlanLimits(plan: AccountPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function isPaidPlan(plan: AccountPlan): boolean {
  return plan === "standard" || plan === "premium";
}
