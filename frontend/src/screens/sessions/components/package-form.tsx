"use client";

import { type FormEvent, useState } from "react";
import { CurrencyInput } from "@/components/examples/input/special/currency-input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/context";
import { type CurrencyCode } from "@crm/shared/currency";

export function PackageForm({
  currency,
  onSubmit
}: {
  currency: CurrencyCode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const [selectedCurrency, setSelectedCurrency] = useState(currency);

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="package-name">{t("form.packageName")}</FieldLabel>
          <Input id="package-name" name="name" placeholder={t("form.packageName")} required />
        </Field>
        <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="package-lesson-count">{t("form.lessonCount")}</FieldLabel>
            <Input id="package-lesson-count" name="lessonCount" type="number" min="1" placeholder={t("form.lessonCount")} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="package-price">{t("form.price")}</FieldLabel>
            <CurrencyInput
              id="package-price"
              name="price"
              currencyName="currency"
              currency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
              placeholder="0"
              required
            />
          </Field>
        </FieldGroup>
        <Button type="submit">{t("form.addPackage")}</Button>
      </FieldGroup>
    </form>
  );
}
