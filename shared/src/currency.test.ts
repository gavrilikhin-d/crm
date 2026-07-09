import { describe, expect, test } from "bun:test";
import { resolveCurrencyFromLocation } from "./currency";

describe("resolveCurrencyFromLocation", () => {
  test("uses timezone for Belarus and Russia", () => {
    expect(resolveCurrencyFromLocation({ timezone: "Europe/Minsk" })).toBe("BYN");
    expect(resolveCurrencyFromLocation({ timezone: "Europe/Moscow" })).toBe("RUB");
  });

  test("uses timezone for the Americas and Europe", () => {
    expect(resolveCurrencyFromLocation({ timezone: "America/New_York" })).toBe("USD");
    expect(resolveCurrencyFromLocation({ timezone: "Europe/Berlin" })).toBe("EUR");
  });

  test("uses locale regions when timezone is unavailable", () => {
    expect(resolveCurrencyFromLocation({ languages: ["ru-BY"] })).toBe("BYN");
    expect(resolveCurrencyFromLocation({ languages: ["ru-RU"] })).toBe("RUB");
    expect(resolveCurrencyFromLocation({ languages: ["en-US"] })).toBe("USD");
    expect(resolveCurrencyFromLocation({ languages: ["de-DE"] })).toBe("EUR");
  });

  test("falls back to BYN for bare Russian and unknown locales", () => {
    expect(resolveCurrencyFromLocation({ languages: ["ru"] })).toBe("BYN");
    expect(resolveCurrencyFromLocation({ languages: ["ja-JP"] })).toBe("BYN");
  });

  test("prefers timezone over language preferences", () => {
    expect(
      resolveCurrencyFromLocation({
        languages: ["en-US"],
        timezone: "Europe/Moscow"
      })
    ).toBe("RUB");
  });
});
