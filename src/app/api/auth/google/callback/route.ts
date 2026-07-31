import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/auth";
import { exchangeCode } from "@/lib/google";

// GET /api/auth/google/callback — exchange the code, upsert the user, set the session cookie.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=nocode", request.url));
  }

  let profile;
  try {
    profile = await exchangeCode(code);
  } catch {
    return NextResponse.redirect(new URL("/login?error=exchange", request.url));
  }
  if (!profile.email) {
    return NextResponse.redirect(new URL("/login?error=noemail", request.url));
  }

  const existing = await db.user.findUnique({ where: { email: profile.email } });

  // Match a seeded user by email (keep their role); otherwise onboard as PRODUCER.
  const tokenData = {
    googleId: profile.googleId || undefined,
    image: profile.image ?? undefined,
    googleAccessToken: profile.accessToken ?? undefined,
    // Only overwrite the refresh token when Google returns a fresh one.
    ...(profile.refreshToken ? { googleRefreshToken: profile.refreshToken } : {}),
    googleTokenExpiry: profile.expiry ?? undefined,
  };

  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: tokenData })
    : await db.user.create({
        data: { name: profile.name, email: profile.email, role: "PRODUCER", ...tokenData },
      });

  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(AUTH_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
