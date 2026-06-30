"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useI18n } from "@/i18n/context";
import { api } from "@/lib/api";
import type { GoogleCalendarStatus } from "@crm/shared";

type GoogleCalendarSettingsProps = {
  onChanged?: () => Promise<void>;
};

export function GoogleCalendarSettings({ onChanged }: GoogleCalendarSettingsProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api<GoogleCalendarStatus>("/api/google-calendar/status"));
    } catch {
      toast.error(t("toast.actionFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarResult = params.get("calendar");
    if (!calendarResult) {
      return;
    }

    params.delete("calendar");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    if (calendarResult === "connected") {
      toast.success(t("toast.googleCalendarConnected"));
      window.setTimeout(() => {
        void loadStatus();
        void onChanged?.();
      }, 0);
    } else if (calendarResult === "error") {
      toast.error(t("toast.googleCalendarConnectFailed"));
    }
  }, [loadStatus, onChanged, t]);

  async function handleConnect() {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/google-calendar/connect");
      window.location.href = url;
    } catch {
      toast.error(t("toast.actionFailed"));
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(t("settings.googleCalendar.disconnectConfirm"))) {
      return;
    }

    setBusy(true);
    try {
      await api("/api/google-calendar/disconnect", { method: "DELETE" });
      await loadStatus();
      toast.success(t("toast.googleCalendarDisconnected"));
      await onChanged?.();
    } catch {
      toast.error(t("toast.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    try {
      const result = await api<{ synced: number; failed: number }>("/api/google-calendar/sync", {
        method: "POST"
      });
      if (result.failed > 0) {
        toast.warning(t("toast.googleCalendarSynced", { synced: result.synced, failed: result.failed }));
      } else {
        toast.success(t("toast.googleCalendarSynced", { synced: result.synced, failed: result.failed }));
      }
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncEnabledChange(checked: boolean) {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: { googleCalendarSyncEnabled: checked }
      });
      setStatus((current) => (current ? { ...current, syncEnabled: checked } : current));

      if (checked) {
        const result = await api<{ synced: number; failed: number }>("/api/google-calendar/sync", {
          method: "POST"
        });
        toast.success(t("toast.googleCalendarSynced", { synced: result.synced, failed: result.failed }));
      } else {
        toast.success(t("toast.googleCalendarSyncDisabled"));
      }

      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connected ?? false;
  const syncEnabled = status?.syncEnabled ?? false;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{t("settings.googleCalendar.title")}</CardTitle>
        <CardDescription>{t("settings.googleCalendar.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : connected ? (
            <>
              <Field orientation="horizontal">
                <Checkbox
                  id="google-calendar-sync-enabled"
                  checked={syncEnabled}
                  disabled={busy}
                  onCheckedChange={(value) => void handleSyncEnabledChange(value === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor="google-calendar-sync-enabled">
                    {t("settings.googleCalendar.syncEnabled")}
                  </FieldLabel>
                  <FieldDescription>{t("settings.googleCalendar.syncEnabledHint")}</FieldDescription>
                </FieldContent>
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy || !syncEnabled} onClick={() => void handleSyncNow()}>
                  {t("settings.googleCalendar.syncNow")}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void handleDisconnect()}>
                  {t("settings.googleCalendar.disconnect")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <FieldDescription>{t("settings.googleCalendar.connectHint")}</FieldDescription>
              <Button type="button" disabled={busy} onClick={() => void handleConnect()}>
                {t("settings.googleCalendar.connect")}
              </Button>
            </>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
