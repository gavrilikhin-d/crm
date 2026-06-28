import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/context";
import { t } from "@/i18n";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: t("app.title"),
  description: t("app.description")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={cn("font-sans", geist.variable)}>
      <body>
        <I18nProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
