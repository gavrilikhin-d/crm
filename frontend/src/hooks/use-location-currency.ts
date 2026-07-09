"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, LessonPackage, Payment } from "@crm/shared";
import {
  DEFAULT_CURRENCY,
  resolveCurrency,
  type CurrencyCode
} from "@crm/shared/currency";
import { detectLocationCurrency } from "@/lib/currency-location";
import { api } from "@/lib/api";

const CURRENCY_BOOTSTRAP_KEY = "crm.currency.bootstrapped";

function hasBootstrappedCurrency(accountId: string): boolean {
  try {
    return localStorage.getItem(CURRENCY_BOOTSTRAP_KEY) === accountId;
  } catch {
    return false;
  }
}

function markCurrencyBootstrapped(accountId: string): void {
  try {
    localStorage.setItem(CURRENCY_BOOTSTRAP_KEY, accountId);
  } catch {
    // Ignore storage failures.
  }
}

function shouldApplyLocationCurrency(
  settingsCurrency: string | undefined,
  detectedCurrency: CurrencyCode,
  payments: Payment[],
  lessonPackages: LessonPackage[]
): boolean {
  return (
    resolveCurrency(settingsCurrency) === DEFAULT_CURRENCY &&
    detectedCurrency !== DEFAULT_CURRENCY &&
    payments.length === 0 &&
    lessonPackages.length === 0
  );
}

export function useLocationCurrency({
  accountId,
  settingsCurrency,
  payments,
  lessonPackages,
  onCurrencyBootstrapped
}: {
  accountId?: string;
  settingsCurrency?: string;
  payments: Payment[];
  lessonPackages: LessonPackage[];
  onCurrencyBootstrapped?: (settings: AppSettings) => void;
}): CurrencyCode {
  const detectedCurrency = useMemo(() => detectLocationCurrency(), []);
  const bootstrappingRef = useRef(false);
  const [bootstrappedCurrency, setBootstrappedCurrency] = useState<CurrencyCode | null>(null);

  const shouldPreselect = shouldApplyLocationCurrency(
    settingsCurrency,
    detectedCurrency,
    payments,
    lessonPackages
  );
  const storedCurrency = resolveCurrency(bootstrappedCurrency ?? settingsCurrency);

  useEffect(() => {
    if (!accountId || !shouldPreselect || hasBootstrappedCurrency(accountId) || bootstrappingRef.current) {
      return;
    }

    bootstrappingRef.current = true;
    markCurrencyBootstrapped(accountId);

    void api<AppSettings>("/api/settings", {
      method: "PATCH",
      body: { currency: detectedCurrency }
    })
      .then((settings) => {
        setBootstrappedCurrency(resolveCurrency(settings.currency));
        onCurrencyBootstrapped?.(settings);
      })
      .catch(() => {
        bootstrappingRef.current = false;
        try {
          localStorage.removeItem(CURRENCY_BOOTSTRAP_KEY);
        } catch {
          // Ignore storage failures.
        }
      });
  }, [accountId, detectedCurrency, onCurrencyBootstrapped, shouldPreselect]);

  if (shouldPreselect && storedCurrency === DEFAULT_CURRENCY) {
    return detectedCurrency;
  }

  return storedCurrency;
}
