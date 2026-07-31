// Custom Google OAuth2 (no next-auth). Reuses the existing revolio_uid cookie session —
// see ADR-003: real auth swaps the internals of getCurrentUser() with no call-site changes.
// The same googleapis client powers Gmail scanning (src/lib/gmail.ts).

import { google } from "googleapis";
import { db } from "./db";

// gmail.readonly is a sensitive scope: in "testing" mode only added test users can grant it.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function baseUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUri(): string {
  return `${baseUrl()}/api/auth/google/callback`;
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri(),
  );
}

/** Consent URL. offline + consent so we reliably receive a refresh token. */
export function getAuthUrl(): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
  });
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  image: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiry: Date | null;
};

/** Exchange an auth code for tokens + the user's Google profile. */
export async function exchangeCode(code: string): Promise<GoogleProfile> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const { data } = await google.oauth2({ version: "v2", auth: client }).userinfo.get();

  return {
    googleId: data.id ?? "",
    email: (data.email ?? "").toLowerCase(),
    name: data.name ?? data.email ?? "Unknown",
    image: data.picture ?? null,
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

type GmailUser = {
  id: string;
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleTokenExpiry: Date | null;
};

/** Authed Gmail client for a user. Auto-refreshes and persists rotated tokens. */
export function getGmailClient(user: GmailUser) {
  const client = oauthClient();
  client.setCredentials({
    access_token: user.googleAccessToken ?? undefined,
    refresh_token: user.googleRefreshToken ?? undefined,
    expiry_date: user.googleTokenExpiry?.getTime(),
  });

  // Persist refreshed access/refresh tokens so scans keep working past expiry.
  client.on("tokens", (t) => {
    void db.user.update({
      where: { id: user.id },
      data: {
        ...(t.access_token ? { googleAccessToken: t.access_token } : {}),
        ...(t.refresh_token ? { googleRefreshToken: t.refresh_token } : {}),
        ...(t.expiry_date ? { googleTokenExpiry: new Date(t.expiry_date) } : {}),
      },
    }).catch(() => {});
  });

  return google.gmail({ version: "v1", auth: client });
}

export function isGmailConnected(user: { googleRefreshToken?: string | null }): boolean {
  return !!user.googleRefreshToken;
}
