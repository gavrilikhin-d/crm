import { google } from "googleapis";
import type { GoogleCalendarStatus } from "@crm/shared";
import {
  clearAccountGoogleCalendar,
  getAccountGoogleCalendar,
  updateAccountGoogleCalendarTokens,
  type GoogleCalendarCredentials
} from "../db/repository";
import { createGoogleCalendarOAuthState } from "./oauth-state";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function googleClientConfig() {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required for Google Calendar");
  }

  return { clientId, clientSecret };
}

export function googleCalendarRedirectUri(): string {
  const baseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/api/google-calendar/callback`;
}

function createOAuthClient(credentials?: Pick<GoogleCalendarCredentials, "accessToken" | "refreshToken">) {
  const { clientId, clientSecret } = googleClientConfig();
  const client = new google.auth.OAuth2(clientId, clientSecret, googleCalendarRedirectUri());

  if (credentials?.accessToken || credentials?.refreshToken) {
    client.setCredentials({
      access_token: credentials.accessToken ?? undefined,
      refresh_token: credentials.refreshToken ?? undefined
    });
  }

  return client;
}

export async function createGoogleCalendarConnectUrl(accountId: string): Promise<string> {
  const client = createOAuthClient();
  const state = await createGoogleCalendarOAuthState(accountId);

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [CALENDAR_SCOPE],
    state
  });
}

export async function exchangeGoogleCalendarCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined
  };
}

export async function saveGoogleCalendarTokens(
  accountId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresAt?: string }
): Promise<void> {
  const existing = await getAccountGoogleCalendar(accountId);
  await updateAccountGoogleCalendarTokens(accountId, {
    accessToken: tokens.accessToken,
    tokenExpiresAt: tokens.expiresAt,
    syncEnabled: true,
    ...(tokens.refreshToken
      ? { refreshToken: tokens.refreshToken }
      : existing?.refreshToken
        ? { refreshToken: existing.refreshToken }
        : {})
  });
}

export async function getGoogleCalendarStatus(accountId: string): Promise<GoogleCalendarStatus> {
  const credentials = await getAccountGoogleCalendar(accountId);
  return {
    connected: Boolean(credentials?.refreshToken),
    syncEnabled: credentials?.syncEnabled ?? false,
    calendarId: credentials?.calendarId ?? "primary"
  };
}

export async function disconnectGoogleCalendar(accountId: string): Promise<void> {
  await clearAccountGoogleCalendar(accountId);
}

async function refreshCredentialsIfNeeded(accountId: string, credentials: GoogleCalendarCredentials) {
  const expiresAt = credentials.tokenExpiresAt ? new Date(credentials.tokenExpiresAt).getTime() : 0;
  const shouldRefresh = !credentials.accessToken || expiresAt <= Date.now() + 60_000;

  if (!shouldRefresh) {
    return credentials;
  }

  if (!credentials.refreshToken) {
    throw new Error("Google Calendar refresh token is missing");
  }

  const client = createOAuthClient({
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken
  });
  const { credentials: refreshed } = await client.refreshAccessToken();

  const next: GoogleCalendarCredentials = {
    ...credentials,
    accessToken: refreshed.access_token ?? credentials.accessToken,
    refreshToken: refreshed.refresh_token ?? credentials.refreshToken,
    tokenExpiresAt: refreshed.expiry_date ? new Date(refreshed.expiry_date).toISOString() : credentials.tokenExpiresAt
  };

  await updateAccountGoogleCalendarTokens(accountId, {
    accessToken: next.accessToken,
    refreshToken: next.refreshToken,
    tokenExpiresAt: next.tokenExpiresAt
  });
  return next;
}

export async function withGoogleCalendarClient<T>(
  accountId: string,
  run: (calendar: ReturnType<typeof google.calendar>, calendarId: string) => Promise<T>
): Promise<T> {
  const credentials = await getAccountGoogleCalendar(accountId);
  if (!credentials?.refreshToken) {
    throw new Error("Google Calendar is not connected");
  }

  const active = await refreshCredentialsIfNeeded(accountId, credentials);
  const auth = createOAuthClient({
    accessToken: active.accessToken,
    refreshToken: active.refreshToken
  });
  const calendar = google.calendar({ version: "v3", auth });
  return run(calendar, active.calendarId);
}
