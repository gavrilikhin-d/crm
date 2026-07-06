import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { OIDCConfig } from "@auth/core/providers/oauth";
import type { AccountPlan } from "@crm/shared";
import * as Sentry from "@sentry/nextjs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      plan: AccountPlan;
    };
  }
}

const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
const e2eOidcProviderId = "e2e-oidc";

type LocalOidcProfile = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

function authSyncSecret(): string {
  const syncSecret = process.env.AUTH_SYNC_SECRET?.trim();
  if (syncSecret) {
    return syncSecret;
  }

  const authSecret = process.env.AUTH_SECRET?.trim();
  if (!authSecret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return authSecret;
}

function isE2eAuthEnabled(): boolean {
  return process.env.E2E_AUTH === "1";
}

function authProviders() {
  const localOidcProvider = {
    id: e2eOidcProviderId,
    name: "Local OIDC",
    type: "oidc",
    issuer: process.env.AUTH_E2E_OIDC_ISSUER ?? "http://localhost:5556/dex",
    clientId: process.env.AUTH_E2E_OIDC_ID ?? "crm-e2e",
    clientSecret: process.env.AUTH_E2E_OIDC_SECRET ?? "crm-e2e-secret",
    checks: ["pkce", "state"],
    profile(profile) {
      return {
        id: profile.sub,
        email: profile.email,
        name: profile.name ?? profile.email ?? profile.sub,
        image: profile.picture ?? null
      };
    }
  } satisfies OIDCConfig<LocalOidcProfile>;

  return [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET
    }),
    ...(isE2eAuthEnabled() ? [localOidcProvider] : [])
  ];
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: authProviders(),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if ((account?.provider === "google" || account?.provider === e2eOidcProviderId) && profile) {
        if (!profile.sub || !profile.email) {
          console.error("[auth] OAuth profile missing sub or email", {
            provider: account.provider,
            sub: profile.sub,
            email: profile.email
          });
          throw new Error("OAuth profile is incomplete");
        }

        let response: Response;
        try {
          response = await Sentry.startSpan(
            { name: "POST /api/auth/sync", op: "http.client" },
            async () => {
              const traceData = Sentry.getTraceData();
              return fetch(`${backendUrl}/api/auth/sync`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${authSyncSecret()}`,
                  ...(traceData["sentry-trace"] ? { "sentry-trace": traceData["sentry-trace"] } : {}),
                  ...(traceData.baggage ? { baggage: traceData.baggage } : {})
                },
                body: JSON.stringify({
                  googleSub: profile.sub,
                  email: profile.email,
                  name: profile.name ?? profile.email,
                  image: profile.picture,
                  plan: account.provider === e2eOidcProviderId && isE2eAuthEnabled() ? "premium" : undefined
                })
              });
            }
          );
        } catch (error) {
          console.error("[auth] Account sync request failed. Is the backend running on", backendUrl, error);
          throw error;
        }

        if (!response.ok) {
          const details = await response.text().catch(() => "");
          console.error("[auth] Account sync failed:", response.status, details);
          throw new Error(`Failed to sync account (${response.status})`);
        }

        const synced = (await response.json()) as {
          id: string;
          email: string;
          name: string;
          image?: string;
          plan: AccountPlan;
        };

        token.sub = synced.id;
        token.email = synced.email;
        token.plan = synced.plan;
        token.name = synced.name;
        token.picture = synced.image;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.email = token.email as string;
        session.user.plan = token.plan as AccountPlan;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.image = (token.picture as string | undefined) ?? session.user.image;
      }

      return session;
    }
  }
});
