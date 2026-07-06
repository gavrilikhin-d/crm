"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/context";

export default function LoginPage() {
  const { t } = useI18n();
  const providerId = process.env.NEXT_PUBLIC_E2E_AUTH === "1" ? "e2e-oidc" : "google";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black tracking-[0.35em] text-orange-600">VOCAL</CardTitle>
          <CardDescription>{t("auth.loginDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" type="button" onClick={() => void signIn(providerId, { callbackUrl: "/" })}>
            {providerId === "e2e-oidc" ? t("auth.signInWithLocalOidc") : t("auth.signInWithGoogle")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
