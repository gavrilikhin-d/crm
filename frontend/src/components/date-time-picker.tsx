"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { enUS, ru } from "date-fns/locale"
import { CalendarIcon, ClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/context"

const hours = Array.from({ length: 24 }, (_, index) => index)
const minutes = Array.from({ length: 12 }, (_, index) => index * 5)

function formatDateTimeLocalValue(date: Date, hour: number, minute: number): string {
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`
}

function parseDateTimeLocalValue(value?: string): { date?: Date; hour: number; minute: number } {
  if (!value) {
    return { hour: 10, minute: 0 }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return { hour: 10, minute: 0 }
  }

  return {
    date: parsed,
    hour: parsed.getHours(),
    minute: parsed.getMinutes() - (parsed.getMinutes() % 5)
  }
}

type DateTimePickerProps = {
  id?: string
  name: string
  defaultValue?: string
  required?: boolean
  className?: string
}

export function DateTimePicker({ id, name, defaultValue, required, className }: DateTimePickerProps) {
  const { locale, t } = useI18n()
  const dateFnsLocale = locale === "en" ? enUS : ru
  const initial = useMemo(() => parseDateTimeLocalValue(defaultValue), [defaultValue])
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(initial.date)
  const [hour, setHour] = useState(initial.hour)
  const [minute, setMinute] = useState(initial.minute)
  const value = date ? formatDateTimeLocalValue(date, hour, minute) : ""

  const label = date
    ? `${format(date, "d MMMM yyyy", { locale: dateFnsLocale })}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    : t("dateTime.placeholder")

  return (
    <>
      <input id={id} name={name} type="hidden" value={value} required={required ? true : undefined} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-start font-normal", !date && "text-muted-foreground", className)}
          >
            <CalendarIcon data-icon="inline-start" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            locale={dateFnsLocale}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 1, 0)}
            endMonth={new Date(new Date().getFullYear() + 2, 11)}
          />
          <div className="flex items-center gap-2 border-t p-3">
            <ClockIcon className="text-muted-foreground" aria-hidden="true" />
            <NativeSelect
              aria-label={t("dateTime.hourAria")}
              value={String(hour)}
              onChange={(event) => setHour(Number(event.currentTarget.value))}
              className="flex-1"
            >
              {hours.map((item) => (
                <NativeSelectOption key={item} value={String(item)}>
                  {String(item).padStart(2, "0")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <span className="text-muted-foreground">:</span>
            <NativeSelect
              aria-label={t("dateTime.minuteAria")}
              value={String(minute)}
              onChange={(event) => setMinute(Number(event.currentTarget.value))}
              className="flex-1"
            >
              {minutes.map((item) => (
                <NativeSelectOption key={item} value={String(item)}>
                  {String(item).padStart(2, "0")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
