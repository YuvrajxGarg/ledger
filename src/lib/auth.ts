import { cookies } from "next/headers";
import { db } from "./db";
import type { Role } from "./enums";

// --- MOCK AUTH ---------------------------------------------------------------
// Real auth (Auth.js + Google) will replace the internals of getCurrentUser()
// without changing its signature, so no call site needs to change. See ADR-003.
// For now: the selected user id lives in an httpOnly cookie; a dev role-switcher
// (see components/role-switcher.tsx) changes it.

export const AUTH_COOKIE = "revolio_uid";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const uid = store.get(AUTH_COOKIE)?.value;

  const user = uid
    ? await db.user.findUnique({ where: { id: uid } })
    : await db.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  };
}

/** Throws-free helper for pages that must have a user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user in session (run `npx prisma db seed`).");
  return user;
}

/**
 * Full DB user record for the current session — includes Google/Gmail token fields
 * that SessionUser intentionally omits. Used by the invoices/Gmail flows.
 */
export async function getCurrentUserRecord() {
  const store = await cookies();
  const uid = store.get(AUTH_COOKIE)?.value;
  return uid
    ? db.user.findUnique({ where: { id: uid } })
    : db.user.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getAllUsers() {
  return db.user.findMany({ orderBy: { createdAt: "asc" } });
}

export function can(role: Role, action: "approve" | "dispatch" | "markPaid" | "configure") {
  switch (action) {
    case "approve":
    case "dispatch":
      return role === "SENIOR_PRODUCER" || role === "ADMIN";
    case "markPaid":
      return role === "ACCOUNTS" || role === "ADMIN";
    case "configure":
      return role === "ADMIN";
  }
}
