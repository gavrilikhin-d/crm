export const DEFAULT_CURRENCY = "BYN";

export const CURRENCIES = [
  { code: "BYN", label: "Белорусский рубль" },
  { code: "RUB", label: "Российский рубль" },
  { code: "USD", label: "Доллар США" },
  { code: "EUR", label: "Евро" }
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const EU_REGIONS = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE"
]);

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  BYN: "ru-BY",
  RUB: "ru-RU",
  USD: "en-US",
  EUR: "de-DE"
};

export function isSupportedCurrency(value: string): value is CurrencyCode {
  return CURRENCIES.some((item) => item.code === value);
}

export function resolveCurrency(value: string | undefined): CurrencyCode {
  if (value && isSupportedCurrency(value)) {
    return value;
  }
  return DEFAULT_CURRENCY;
}

export function resolveCurrencyFromLocation(input?: {
  languages?: readonly string[];
  timezone?: string;
  fallback?: CurrencyCode;
}): CurrencyCode {
  const fallback = input?.fallback ?? DEFAULT_CURRENCY;
  const timezone = input?.timezone?.trim();

  if (timezone === "Europe/Minsk") {
    return "BYN";
  }
  if (timezone === "Europe/Moscow") {
    return "RUB";
  }
  if (timezone?.startsWith("America/")) {
    return "USD";
  }
  if (timezone?.startsWith("Europe/")) {
    return "EUR";
  }

  for (const preference of input?.languages ?? []) {
    const normalized = preference.trim();
    if (!normalized) {
      continue;
    }

    const segments = normalized.split("-");
    const language = segments[0]?.toLowerCase();
    const region = segments[1]?.toUpperCase();

    if (region === "BY") {
      return "BYN";
    }
    if (region === "RU") {
      return "RUB";
    }
    if (region === "US") {
      return "USD";
    }
    if (region && EU_REGIONS.has(region)) {
      return "EUR";
    }
    if (language === "be") {
      return "BYN";
    }
    if (language === "ru") {
      return region ? fallback : "BYN";
    }
    if (language === "en") {
      return "USD";
    }
  }

  return fallback;
}

export function getCurrencyLabel(code: string): string {
  return CURRENCIES.find((item) => item.code === code)?.label ?? code;
}

export function getCurrencySymbol(currency: string): string {
  const code = resolveCurrency(currency);
  const parts = new Intl.NumberFormat(LOCALE_BY_CURRENCY[code], {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0
  }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? code;
}

export function formatMoney(amount: number, currency: string): string {
  const code = resolveCurrency(currency);
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[code], {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0
  }).format(amount);
}
