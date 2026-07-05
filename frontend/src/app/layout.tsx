import { Providers } from "@/app/providers";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/context";
import { t } from "@/i18n";
import { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, resolveLocale } from "@/i18n/locale";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const localeCookieMaxAge = 60 * 60 * 24 * 365;
const localeBootstrapScript = `(() => {
  try {
    const supportedLocales = ${JSON.stringify(SUPPORTED_LOCALES)};
    const storedLocale = window.localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});
    if (!supportedLocales.includes(storedLocale)) {
      return;
    }
    document.cookie = ${JSON.stringify(LOCALE_COOKIE_NAME)} + "=" + storedLocale + "; path=/; max-age=${localeCookieMaxAge}; samesite=lax";
    if (document.documentElement.lang !== storedLocale) {
      document.documentElement.lang = storedLocale;
      document.documentElement.dataset.localePending = "true";
    }
  } catch {}
})();`;

export const metadata: Metadata = {
  title: t("app.title"),
  description: t("app.description")
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const initialLocale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <html lang={initialLocale} className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <style>{`html[data-locale-pending="true"] body { visibility: hidden; }`}</style>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrapScript }} />
      </head>
      <body>
        <I18nProvider locale={initialLocale}>
          <Providers>
            <TooltipProvider>{children}</TooltipProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
