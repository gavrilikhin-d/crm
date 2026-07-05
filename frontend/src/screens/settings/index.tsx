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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/i18n/context";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/locale";
import type { AccountInfo, AppSettings } from "@crm/shared";
import { CURRENCIES, type CurrencyCode } from "@crm/shared/currency";
import { PLAN_META } from "@crm/shared/plans";
import { pageSectionClass } from "@/screens/dashboard/constants";
import { api } from "@/lib/api";
import { PlanUsageRow } from "./components/plan-usage-row";

const reminderMinutePresets = [15, 60, 120, 1440];

export function SettingsView({
  accountInfo,
  currency,
  lessonReminderMinutes,
  onCurrencyChange,
  onLessonReminderMinutesChange,
  onRefresh
}: {
  accountInfo: AccountInfo | null;
  currency: CurrencyCode;
  lessonReminderMinutes: AppSettings["lessonReminderMinutes"];
  onCurrencyChange: (currency: CurrencyCode) => void;
  onLessonReminderMinutesChange: (minutes: number[]) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { locale, setLocale, t } = useI18n();
  const plan = accountInfo?.account.plan ?? "free";
  const accountEmail = accountInfo?.account.email ?? "";
  const [selectedReminderMinutes, setSelectedReminderMinutes] = useState<string[] | null>(null);
  const [customReminderText, setCustomReminderText] = useState("");
  const [savingReminderMinutes, setSavingReminderMinutes] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const selectedReminderMinuteValues = selectedReminderMinutes ?? lessonReminderMinutes.map(String);
  const reminderValues = selectedReminderMinuteValues
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => b - a);
  const reminderValuesChanged = reminderValues.join(",") !== lessonReminderMinutes.join(",");
  const customReminderMinutes = reminderValues.filter((value) => !reminderMinutePresets.includes(value));

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

  async function handleReminderMinutesSave() {
    if (!reminderValues.length || !reminderValuesChanged) {
      return;
    }

    setSavingReminderMinutes(true);
    try {
      await onLessonReminderMinutesChange(reminderValues);
      setSelectedReminderMinutes(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.saveFailed"));
    } finally {
      setSavingReminderMinutes(false);
    }
  }

  function handleAddCustomReminderMinutes() {
    const customValues = parseReminderMinutesInput(customReminderText);
    if (!customValues.length) {
      toast.error(t("settings.lessonReminders.customInvalid"));
      return;
    }

    const nextValues = [...new Set([...reminderValues, ...customValues])]
      .sort((a, b) => b - a)
      .map(String);
    setSelectedReminderMinutes(nextValues);
    setCustomReminderText("");
  }

  function formatReminderMinutes(minutes: number): string {
    if (minutes % 1440 === 0) {
      const days = minutes / 1440;
      if (days === 1) {
        return t("settings.lessonReminders.units.twentyFourHours");
      }
      return t("settings.lessonReminders.units.days", { count: days });
    }
    if (minutes % 60 === 0) {
      return t("settings.lessonReminders.units.hours", { count: minutes / 60 });
    }
    return t("settings.lessonReminders.units.minutes", { count: minutes });
  }

  return (
    <section className={pageSectionClass} id="settings">
      <div className="grid max-w-6xl gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <div className="grid content-start gap-3">
          <Card size="sm" className="gap-3 py-3">
            <CardContent className="px-3">
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="settings-language">{t("settings.language")}</FieldLabel>
                  <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                    <SelectTrigger id="settings-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {SUPPORTED_LOCALES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {t(`settings.languages.${item}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
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
                            {t(`settings.currencies.${item.code}`)} ({item.code})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="sm" className="gap-3 py-3">
            <CardHeader className="px-3">
              <CardTitle>{t("settings.lessonReminders.title")}</CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("settings.lessonReminders.leadTimes")}</FieldLabel>
                  <ToggleGroup
                    type="multiple"
                    value={selectedReminderMinuteValues}
                    onValueChange={(values) => {
                      if (values.length) {
                        setSelectedReminderMinutes(values);
                      }
                    }}
                    variant="outline"
                    className="flex-wrap"
                  >
                    {reminderMinutePresets.map((minutes) => (
                      <ToggleGroupItem key={minutes} value={String(minutes)}>
                        {formatReminderMinutes(minutes)}
                      </ToggleGroupItem>
                    ))}
                    {customReminderMinutes.map((minutes) => (
                      <ToggleGroupItem key={minutes} value={String(minutes)}>
                        {formatReminderMinutes(minutes)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="settings-custom-reminder-minutes">
                    {t("settings.lessonReminders.customLabel")}
                  </FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="settings-custom-reminder-minutes"
                      value={customReminderText}
                      onChange={(event) => setCustomReminderText(event.target.value)}
                      placeholder={t("settings.lessonReminders.customPlaceholder")}
                      inputMode="numeric"
                    />
                    <Button type="button" variant="outline" onClick={handleAddCustomReminderMinutes}>
                      {t("settings.lessonReminders.customAdd")}
                    </Button>
                  </div>
                </Field>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={!reminderValues.length || !reminderValuesChanged || savingReminderMinutes}
                  onClick={handleReminderMinutesSave}
                >
                  {savingReminderMinutes ? t("settings.lessonReminders.saving") : t("settings.lessonReminders.save")}
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>

          <GoogleCalendarSettings onChanged={onRefresh} />
        </div>

        <aside className="grid content-start gap-3">
          {accountInfo ? (
            <Card size="sm" className="gap-3 py-3">
              <CardHeader className="px-3">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {t("plan.current")}
                  <Badge variant="secondary">{t(`plan.${plan}`)}</Badge>
                  {PLAN_META[plan].hasPrioritySupport ? (
                    <Badge variant="outline">{t("plan.prioritySupport")}</Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 px-3">
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
                <PlanUsageRow
                  label={t("plan.usage.recurringSchedules")}
                  used={accountInfo.usage.recurringSchedules}
                  limit={accountInfo.limits.maxRecurringSchedules}
                />
                <Button type="button" disabled className="w-full sm:w-auto">
                  {t("plan.upgradeSoon")}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card size="sm" className="gap-3 border-destructive/30 py-3">
            <CardHeader className="px-3">
              <CardTitle>{t("settings.accountDeletion.title")}</CardTitle>
              <CardDescription>{t("settings.accountDeletion.description")}</CardDescription>
            </CardHeader>
            <CardContent className="px-3">
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
                  <Button type="button" variant="destructive" disabled={!accountInfo}>
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
              {!accountInfo ? (
                <p className="mt-2 text-sm text-muted-foreground">{t("settings.accountDeletion.loading")}</p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function parseReminderMinutesInput(value: string): number[] {
  return [...new Set(value.split(/[,\s]+/).map(Number).filter((item) => Number.isInteger(item) && item > 0))]
    .sort((a, b) => b - a)
    .slice(0, 8);
}
