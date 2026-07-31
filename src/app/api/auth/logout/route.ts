import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

// GET /api/auth/logout — clear the session cookie and return to /login.
export function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
