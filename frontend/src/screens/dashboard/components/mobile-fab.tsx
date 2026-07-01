"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/context";
import type { ActiveSection } from "@/screens/dashboard/types";

export function MobileFab({
  activeSection,
  onScheduleLesson,
  onAddStudent,
  onAddPayment,
  onAddPackage
}: {
  activeSection: ActiveSection;
  onScheduleLesson: () => void;
  onAddStudent: () => void;
  onAddPayment: () => void;
  onAddPackage: () => void;
}) {
  const { t } = useI18n();

  const actionBySection: Partial<
    Record<ActiveSection, { label: string; onClick: () => void }>
  > = {
    schedule: { label: t("calendar.scheduleLesson"), onClick: onScheduleLesson },
    clients: { label: t("clients.addStudentAria"), onClick: onAddStudent },
    payments: { label: t("payments.addPaymentAria"), onClick: onAddPayment },
    sessions: { label: t("packages.addPackageAria"), onClick: onAddPackage }
  };

  const action = actionBySection[activeSection];
  if (!action) {
    return null;
  }

  return (
    <Button
      type="button"
      className="fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] z-40 size-14 rounded-full shadow-lg sm:hidden"
      onClick={action.onClick}
      aria-label={action.label}
    >
      <Plus className="size-6" />
    </Button>
  );
}
