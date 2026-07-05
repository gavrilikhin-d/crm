import type { LessonStatus, LessonType, ParticipantStatus, PaymentMethod, StudentStatus } from "@crm/shared";
import { t as defaultT } from "@/i18n";
import type { TranslationKey, TranslationParams } from "@/i18n/types";

const WEEKDAY_KEYS_MON_FIRST = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_KEYS_SUN_FIRST = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type WeekdayOrder = "mon" | "sun";
type Translate = <K extends TranslationKey>(
  key: K,
  ...args: TranslationParams<K> extends undefined ? [] : [TranslationParams<K>]
) => string;

function getWeekdayShortLabels(order: WeekdayOrder = "mon", t: Translate = defaultT): string[] {
  const keys = order === "mon" ? WEEKDAY_KEYS_MON_FIRST : WEEKDAY_KEYS_SUN_FIRST;
  return keys.map((key) => t(`weekday.short.${key}`));
}

function getLessonStatusLabel(status: LessonStatus | string, t: Translate = defaultT): string {
  const key = `lessonStatus.${status}` as `lessonStatus.${LessonStatus}`;
  try {
    return t(key);
  } catch {
    return status;
  }
}

function getLessonTypeLabel(type: LessonType, t: Translate = defaultT): string {
  return t(`lessonType.${type}`);
}

function getParticipantStatusLabel(status: ParticipantStatus, t: Translate = defaultT): string {
  return t(`participantStatus.${status}`);
}

function getPaymentMethodLabel(method: PaymentMethod, t: Translate = defaultT): string {
  return t(`paymentMethod.${method}`);
}

function getStudentStatusLabel(status: StudentStatus, t: Translate = defaultT): string {
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
