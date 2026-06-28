"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getCurrencySymbol, type CurrencyCode } from "@crm/shared/currency";

function CurrencyInput({
  className,
  currency,
  ...props
}: React.ComponentProps<"input"> & {
  currency: CurrencyCode | string;
}) {
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="relative w-full">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground"
      >
        {symbol}
      </span>
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
