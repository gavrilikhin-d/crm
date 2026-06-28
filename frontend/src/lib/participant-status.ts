import type { ParticipantStatus } from "@crm/shared";

const participantStatusLabels: Record<ParticipantStatus, string> = {
  awaiting: "Ожидает ответа",
  confirmed: "Подтверждено",
  declined: "Отказался",
  missed: "Пропуск",
  attended: "Посетил"
};

const participantStatusBadgeClass: Record<ParticipantStatus, string> = {
  awaiting:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300",
  confirmed:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-300",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
  missed:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-300",
  attended:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300"
};

export { participantStatusBadgeClass, participantStatusLabels };
