import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM преподавателя",
  description: "Мини-CRM для преподавателя вокала или репетитора"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
