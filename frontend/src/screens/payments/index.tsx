"use client";

import { Plus } from "lucide-react";
import { StudentLink } from "@/components/student-link";
import { StudentAvatar } from "@/components/student-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/context";
import { formatDateTime, formatFullDate } from "@/i18n/format";
import type { Student } from "@crm/shared";
import { formatMoney } from "@crm/shared/currency";
import { pageSectionClass } from "@/screens/dashboard/constants";
import type { Snapshot } from "@/screens/dashboard/types";

export function PaymentsView({
  payments,
  getStudent,
  onAddPayment
}: {
  payments: Snapshot["payments"];
  getStudent: (studentId: string) => Student | undefined;
  onAddPayment: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className={pageSectionClass}>
      <Card size="sm" className="gap-2 py-3 sm:gap-4 sm:py-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            {t("payments.title")} <Badge variant="secondary">{payments.length}</Badge>
            <Button size="icon-sm" type="button" className="hidden sm:inline-flex" onClick={onAddPayment} aria-label={t("payments.addPaymentAria")}>
              <Plus className="size-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 px-3 sm:px-4">
          {payments.map((payment) => {
            const student = getStudent(payment.studentId);

            return (
              <div
                key={payment.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5"
              >
                {student ? (
                  <StudentLink studentId={student.id} className="shrink-0">
                    <StudentAvatar student={student} size="sm" />
                  </StudentLink>
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    ?
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900 sm:text-base">
                    {student ? (
                      <StudentLink studentId={student.id}>{student.fullName}</StudentLink>
                    ) : (
                      t("payments.studentDeleted")
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">
                    <span className="sm:hidden">{formatDateTime(payment.paidAt)}</span>
                    <span className="hidden sm:inline">{formatFullDate(payment.paidAt)}</span>
                    {" · "}
                    {t("common.lessonsCount", { count: payment.lessonCount })}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold sm:text-base">
                  {formatMoney(payment.amount, payment.currency)}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
