import { resolveCurrencyFromLocation, type CurrencyCode } from "@crm/shared/currency";

export function detectLocationCurrency(): CurrencyCode {
  const languages = typeof navigator !== "undefined" ? navigator.languages : [];
  const timezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  return resolveCurrencyFromLocation({ languages, timezone });
}
