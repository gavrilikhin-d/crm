"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CURRENCIES, getCurrencySymbol, type CurrencyCode } from "@crm/shared/currency";

function CurrencyInput({
  className,
  currency,
  currencyName,
  onCurrencyChange,
  ...props
}: React.ComponentProps<"input"> & {
  currency: CurrencyCode | string;
  currencyName?: string;
  onCurrencyChange?: (currency: CurrencyCode) => void;
}) {
  const symbol = getCurrencySymbol(currency);
  const interactive = Boolean(onCurrencyChange);

  return (
    <div className="relative w-full">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground"
      >
        {symbol}
      </span>
      {interactive ? (
        <select
          aria-label="Валюта"
          name={currencyName}
          value={currency}
          onChange={(event) => onCurrencyChange?.(event.target.value as CurrencyCode)}
          className="absolute inset-y-0 left-0 z-10 w-9 cursor-pointer opacity-0"
        >
          {CURRENCIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code}
            </option>
          ))}
        </select>
      ) : null}
      <Input
        className={cn("bg-background pl-9", className)}
        min={0}
        step={1}
        type="number"
        {...props}
      />
    </div>
  );
}

export { CurrencyInput };
