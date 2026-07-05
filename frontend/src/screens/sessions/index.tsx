"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/context";
import type { LessonPackage } from "@crm/shared";
import { formatMoney } from "@crm/shared/currency";
import { pageSectionClass } from "@/screens/dashboard/constants";

export function SessionsView({
  lessonPackages,
  onAddPackage,
  onDeletePackage
}: {
  lessonPackages: LessonPackage[];
  onAddPackage: () => void;
  onDeletePackage: (lessonPackage: LessonPackage) => void;
}) {
  const { t } = useI18n();

  return (
    <section className={pageSectionClass}>
      <Card size="sm" className="gap-2 py-3 sm:gap-4 sm:py-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            {t("section.packages")} <Badge variant="secondary">{lessonPackages.length}</Badge>
            <Button size="icon-sm" type="button" className="hidden sm:inline-flex" onClick={onAddPackage} aria-label={t("packages.addPackageAria")}>
              <Plus className="size-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 px-3 sm:px-4">
          {lessonPackages.map((lessonPackage) => {
            const unitPrice = Math.round(lessonPackage.price / lessonPackage.lessonCount);

            return (
              <div
                key={lessonPackage.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-lg border border-primary px-2.5 py-2 sm:gap-3 sm:rounded-2xl sm:border-2 sm:px-3 sm:py-2.5"
              >
                <p className="truncate text-sm font-medium sm:text-lg">{lessonPackage.name}</p>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary sm:text-xl">{formatMoney(lessonPackage.price, lessonPackage.currency)}</p>
                  <p className="text-[0.6875rem] text-muted-foreground sm:text-sm">
                    {formatMoney(unitPrice, lessonPackage.currency)}
                    {t("packages.perLesson")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => onDeletePackage(lessonPackage)}
                  aria-label={t("packages.deletePackageAria", { name: lessonPackage.name })}
                >
                  <Trash2 className="size-3.5 sm:size-4" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
