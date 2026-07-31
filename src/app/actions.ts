"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE } from "@/lib/auth";

/** Mock auth: switch the active user (dev role switcher). */
export async function switchUser(uid: string) {
  const store = await cookies();
  store.set(AUTH_COOKIE, uid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
