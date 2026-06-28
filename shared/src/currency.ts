export const DEFAULT_CURRENCY = "BYN";

export const CURRENCIES = [
  { code: "BYN", label: "Белорусский рубль" },
  { code: "RUB", label: "Российский рубль" },
  { code: "USD", label: "Доллар США" },
  { code: "EUR", label: "Евро" }
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

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
