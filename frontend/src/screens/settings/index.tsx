"use client";

import { useState, type FormEvent } from "react";
import { GoogleCalendarSettings } from "@/components/google-calendar-settings";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useI18n } from "@/i18n/context";
import type { AccountInfo } from "@crm/shared";
import { CURRENCIES, type CurrencyCode } from "@crm/shared/currency";
import { PLAN_META } from "@crm/shared/plans";
import { pageSectionClass } from "@/screens/dashboard/constants";
import { api } from "@/lib/api";
import { PlanUsageRow } from "./components/plan-usage-row";

export function SettingsView({
  accountInfo,
  currency,
  onCurrencyChange,
  onRefresh
}: {
  accountInfo: AccountInfo | null;
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const plan = accountInfo?.account.plan ?? "free";
  const accountEmail = accountInfo?.account.email ?? "";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountInfo || deleteConfirmation !== accountEmail) {
      return;
    }

    setDeletingAccount(true);
    try {
      await api("/api/account", { method: "DELETE" });
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.accountDeleteFailed"));
      setDeletingAccount(false);
    }
  }

  return (
    <section className={pageSectionClass} id="settings">
      <div className="grid max-w-xl gap-4">
        {accountInfo ? (
          <Card size="sm" className="gap-2 py-3 sm:gap-4 sm:py-4">
            <CardHeader className="pb-0">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {t("plan.current")}
                <Badge variant="secondary">{t(`plan.${plan}`)}</Badge>
                {PLAN_META[plan].hasPrioritySupport ? (
                  <Badge variant="outline">{t("plan.prioritySupport")}</Badge>
                ) : null}
              </CardTitle>
              <CardDescription>{t("plan.usageDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 px-3 sm:px-4">
              <PlanUsageRow
                label={t("plan.usage.students")}
                used={accountInfo.usage.students}
                limit={accountInfo.limits.maxStudents}
              />
              <PlanUsageRow
                label={t("plan.usage.lessonsThisMonth")}
                used={accountInfo.usage.lessonsThisMonth}
                limit={accountInfo.limits.maxLessonsPerMonth}
              />
              <PlanUsageRow
                label={t("plan.usage.packages")}
                used={accountInfo.usage.packages}
                limit={accountInfo.limits.maxPackages}
              />
              <p className="text-sm text-muted-foreground">
                {accountInfo.limits.recurringEnabled ? t("plan.recurringEnabled") : t("plan.recurringDisabled")}
              </p>
              <Button type="button" disabled className="mt-2 w-full sm:w-auto">
                {t("plan.upgradeSoon")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{t("settings.title")}</CardTitle>
            <CardDescription>{t("settings.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="settings-currency">{t("settings.currency")}</FieldLabel>
                <Select value={currency} onValueChange={(value) => onCurrencyChange(value as CurrencyCode)}>
                  <SelectTrigger id="settings-currency" className="w-full">
                    <SelectValue placeholder={t("settings.selectCurrency")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CURRENCIES.map((item) => (
                        <SelectItem key={item.code} value={item.code}>
                          {item.label} ({item.code})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t("settings.currencyHint")}</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <GoogleCalendarSettings onChanged={onRefresh} />

        {accountInfo ? (
          <Card className="max-w-xl border-destructive/30">
            <CardHeader>
              <CardTitle>{t("settings.accountDeletion.title")}</CardTitle>
              <CardDescription>{t("settings.accountDeletion.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                  setDeleteDialogOpen(open);
                  if (!open) {
                    setDeleteConfirmation("");
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    {t("settings.accountDeletion.open")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleDeleteAccount} className="grid gap-4">
                    <DialogHeader>
                      <DialogTitle>{t("settings.accountDeletion.confirmTitle")}</DialogTitle>
                      <DialogDescription>
                        {t("settings.accountDeletion.confirmDescription", { email: accountEmail })}
                      </DialogDescription>
                    </DialogHeader>
                    <Field>
                      <FieldLabel htmlFor="delete-account-confirmation">
                        {t("settings.accountDeletion.confirmLabel")}
                      </FieldLabel>
                      <Input
                        id="delete-account-confirmation"
                        value={deleteConfirmation}
                        onChange={(event) => setDeleteConfirmation(event.target.value)}
                        placeholder={accountEmail}
                        autoComplete="off"
                        disabled={deletingAccount}
                      />
                      <FieldDescription>{t("settings.accountDeletion.confirmHint")}</FieldDescription>
                    </Field>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={deletingAccount}>
                          {t("form.cancel")}
                        </Button>
                      </DialogClose>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={deletingAccount || deleteConfirmation !== accountEmail}
                      >
                        {deletingAccount ? t("settings.accountDeletion.deleting") : t("settings.accountDeletion.confirm")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
