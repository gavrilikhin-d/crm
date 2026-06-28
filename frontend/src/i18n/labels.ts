import type { LessonStatus, LessonType, ParticipantStatus, PaymentMethod, StudentStatus } from "@crm/shared";
import { t } from "@/i18n";

const WEEKDAY_KEYS_MON_FIRST = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_KEYS_SUN_FIRST = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type WeekdayOrder = "mon" | "sun";

function getWeekdayShortLabels(order: WeekdayOrder = "mon"): string[] {
  const keys = order === "mon" ? WEEKDAY_KEYS_MON_FIRST : WEEKDAY_KEYS_SUN_FIRST;
  return keys.map((key) => t(`weekday.short.${key}`));
}

function getLessonStatusLabel(status: LessonStatus | string): string {
  const key = `lessonStatus.${status}` as `lessonStatus.${LessonStatus}`;
  try {
    return t(key);
  } catch {
    return status;
  }
}

function getLessonTypeLabel(type: LessonType): string {
  return t(`lessonType.${type}`);
}

function getParticipantStatusLabel(status: ParticipantStatus): string {
  return t(`participantStatus.${status}`);
}

function getPaymentMethodLabel(method: PaymentMethod): string {
  return t(`paymentMethod.${method}`);
}

function getStudentStatusLabel(status: StudentStatus): string {
  return t(`studentStatus.${status}`);
}

export {
  getWeekdayShortLabels,
  getLessonStatusLabel,
  getLessonTypeLabel,
  getParticipantStatusLabel,
  getPaymentMethodLabel,
  getStudentStatusLabel,
  WEEKDAY_KEYS_MON_FIRST,
  WEEKDAY_KEYS_SUN_FIRST
};
