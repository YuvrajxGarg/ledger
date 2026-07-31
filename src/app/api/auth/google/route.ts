import { NextResponse } from "next/server";
import { getAuthUrl, googleConfigured } from "@/lib/google";

// GET /api/auth/google → kick off the Google consent flow.
export function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }
  return NextResponse.redirect(getAuthUrl());
}
