"use client";

import { useState, type FormEvent } from "react";
import { Palmtree, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/context";
import { formatLongDate } from "@/i18n/format";
import { api } from "@/lib/api";
import { toLocalDateKey } from "@crm/shared/vacation";
import type { VacationPeriod } from "@crm/shared";

type VacationDialogProps = {
  vacationPeriods: VacationPeriod[];
  defaultDate?: Date;
  onChanged?: () => Promise<void>;
};

function formatVacationDate(dateKey: string): string {
  return formatLongDate(`${dateKey}T12:00:00`);
}

function formatVacationRange(period: VacationPeriod): string {
  const datePart =
    period.startsOn === period.endsOn
      ? formatVacationDate(period.startsOn)
      : `${formatVacationDate(period.startsOn)} – ${formatVacationDate(period.endsOn)}`;

  if (!period.startsAtTime && !period.endsAtTime) {
    return datePart;
  }

  const startTime = period.startsAtTime ?? "00:00";
  const endTime = period.endsAtTime ?? "24:00";
  return `${datePart}, ${startTime} – ${endTime === "24:00" ? "00:00" : endTime}`;
}

export function VacationDialog({ vacationPeriods, defaultDate, onChanged }: VacationDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [useTime, setUseTime] = useState(false);
  const [startsAtTime, setStartsAtTime] = useState("");
  const [endsAtTime, setEndsAtTime] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && defaultDate) {
      const dateKey = toLocalDateKey(defaultDate);
      setStartsOn(dateKey);
      setEndsOn(dateKey);
      setUseTime(false);
      setStartsAtTime("");
      setEndsAtTime("");
      setLabel("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startsOn || !endsOn) {
      toast.error(t("calendar.vacation.missingDates"));
      return;
    }

    if (!window.confirm(t("calendar.vacation.createConfirm"))) {
      return;
    }

    setBusy(true);
    try {
      const result = await api<{ period: VacationPeriod; cancelledLessons: number }>("/api/vacation-periods", {
        method: "POST",
        body: {
          startsOn,
          endsOn,
          startsAtTime: useTime && startsAtTime ? startsAtTime : undefined,
          endsAtTime: useTime && endsAtTime ? endsAtTime : undefined,
          label: label.trim() || undefined
        }
      });
      toast.success(t("calendar.vacation.created", { count: result.cancelledLessons }));
      setLabel("");
      handleOpenChange(false);
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(period: VacationPeriod) {
    if (!window.confirm(t("calendar.vacation.deleteConfirm"))) {
      return;
    }

    setBusy(true);
    try {
      await api(`/api/vacation-periods/${period.id}`, { method: "DELETE" });
      toast.success(t("calendar.vacation.deleted"));
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" type="button" className="gap-1.5 px-2 sm:px-3">
          <Palmtree className="size-4" />
          <span className="hidden sm:inline">{t("calendar.vacation.add")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("calendar.vacation.title")}</DialogTitle>
          <DialogDescription>{t("calendar.vacation.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="vacation-starts-on">{t("calendar.vacation.startsOn")}</FieldLabel>
                <Input
                  id="vacation-starts-on"
                  type="date"
                  value={startsOn}
                  disabled={busy}
                  onChange={(event) => setStartsOn(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="vacation-ends-on">{t("calendar.vacation.endsOn")}</FieldLabel>
                <Input
                  id="vacation-ends-on"
                  type="date"
                  value={endsOn}
                  disabled={busy}
                  min={startsOn || undefined}
                  onChange={(event) => setEndsOn(event.target.value)}
                  required
                />
              </Field>
            </div>

            <Field orientation="horizontal">
              <Checkbox
                id="vacation-use-time"
                checked={useTime}
                disabled={busy}
                onCheckedChange={(value) => setUseTime(value === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="vacation-use-time">{t("calendar.vacation.useTime")}</FieldLabel>
                <FieldDescription>{t("calendar.vacation.useTimeHint")}</FieldDescription>
              </FieldContent>
            </Field>

            {useTime ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="vacation-starts-at-time">{t("calendar.vacation.startsAtTime")}</FieldLabel>
                  <Input
                    id="vacation-starts-at-time"
                    type="time"
                    value={startsAtTime}
                    disabled={busy}
                    onChange={(event) => setStartsAtTime(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="vacation-ends-at-time">{t("calendar.vacation.endsAtTime")}</FieldLabel>
                  <Input
                    id="vacation-ends-at-time"
                    type="time"
                    value={endsAtTime}
                    disabled={busy}
                    onChange={(event) => setEndsAtTime(event.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            <Field>
              <FieldLabel htmlFor="vacation-label">{t("calendar.vacation.labelField")}</FieldLabel>
              <Input
                id="vacation-label"
                value={label}
                disabled={busy}
                placeholder={t("calendar.vacation.labelPlaceholder")}
                onChange={(event) => setLabel(event.target.value)}
              />
              <FieldDescription>{t("calendar.vacation.labelHint")}</FieldDescription>
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {t("calendar.vacation.submit")}
            </Button>
          </FieldGroup>
        </form>

        <div className="mt-4 grid gap-2">
          {vacationPeriods.length ? (
            vacationPeriods.map((period) => (
              <div
                key={period.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sky-900">{formatVacationRange(period)}</p>
                  {period.label ? <p className="text-sm text-sky-700/80">{period.label}</p> : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={t("calendar.vacation.deleteAria")}
                  onClick={() => void handleDelete(period)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("calendar.vacation.empty")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
