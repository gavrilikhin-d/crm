"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/examples/input/special/currency-input";
import { StudentCombobox } from "@/components/student-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useI18n } from "@/i18n/context";
import { getPaymentMethodLabel } from "@/i18n/labels";
import type { LessonPackage, Student } from "@crm/shared";
import { formatMoney, type CurrencyCode } from "@crm/shared/currency";

export function PaymentForm({
  students,
  lessonPackages,
  currency,
  onSubmit
}: {
  students: Student[];
  lessonPackages: LessonPackage[];
  currency: CurrencyCode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const selectedPackage = lessonPackages.find((item) => item.id === selectedPackageId);
  const paymentCurrency = selectedPackage?.currency ?? selectedCurrency;
  const activeStudents = students.filter((student) => student.status === "active");

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (!selectedStudentId) {
      event.preventDefault();
      toast.error(t("toast.selectStudent"));
      return;
    }
    onSubmit(event);
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="payment-student-id">{t("form.student")}</FieldLabel>
          <StudentCombobox
            id="payment-student-id"
            name="studentId"
            students={activeStudents}
            value={selectedStudentId}
            onValueChange={setSelectedStudentId}
            placeholder={t("form.selectStudent")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="payment-package-id">{t("form.package")}</FieldLabel>
          <NativeSelect
            id="payment-package-id"
            name="packageId"
            value={selectedPackageId}
            onChange={(event) => setSelectedPackageId(event.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">{t("form.noPackage")}</NativeSelectOption>
            {lessonPackages
              .filter((item) => item.active)
              .map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}: {item.lessonCount} / {formatMoney(item.price, item.currency)}
                </NativeSelectOption>
              ))}
          </NativeSelect>
          {selectedPackage ? (
            <FieldDescription>
              {t("packages.summary", {
                count: selectedPackage.lessonCount,
                price: formatMoney(selectedPackage.price, selectedPackage.currency)
              })}
            </FieldDescription>
          ) : null}
        </Field>
        {selectedPackageId ? <input type="hidden" name="currency" value={paymentCurrency} /> : null}
        {!selectedPackageId ? (
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payment-lesson-count">{t("form.lessonCount")}</FieldLabel>
              <Input id="payment-lesson-count" name="lessonCount" type="number" min="1" placeholder={t("form.lessonCount")} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-amount">{t("form.amount")}</FieldLabel>
              <CurrencyInput
                id="payment-amount"
                name="amount"
                currencyName="currency"
                currency={paymentCurrency}
                onCurrencyChange={setSelectedCurrency}
                placeholder="0"
                required
              />
            </Field>
          </FieldGroup>
        ) : null}
        <Field>
          <FieldLabel htmlFor="payment-method">{t("form.paymentMethod")}</FieldLabel>
          <NativeSelect id="payment-method" name="method" required defaultValue="transfer" className="w-full">
            <NativeSelectOption value="transfer">{getPaymentMethodLabel("transfer")}</NativeSelectOption>
            <NativeSelectOption value="cash">{getPaymentMethodLabel("cash")}</NativeSelectOption>
            <NativeSelectOption value="other">{getPaymentMethodLabel("other")}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type="submit">{t("form.addPayment")}</Button>
      </FieldGroup>
    </form>
  );
}
