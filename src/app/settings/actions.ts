"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role, ROLE_LABEL } from "@/lib/enums";
import { SETTING_KEYS, setSetting } from "@/lib/settings";

export type ActionState = { ok: boolean; error?: string; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = Object.values(Role) as string[];

async function requireAdmin() {
  const user = await requireUser();
  if (!can(user.role, "configure")) return null;
  return user;
}

// --- User management ---------------------------------------------------------

export async function addUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorised." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!name) return { ok: false, error: "Name is required." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!ROLES.includes(role)) return { ok: false, error: "Pick a valid role." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: `A user with ${email} already exists.` };

  const created = await db.user.create({ data: { name, email, role } });
  await logAudit({
    entityType: "User",
    entityId: created.id,
    action: "USER_CREATED",
    actorId: admin.id,
    comment: `${name} <${email}> as ${ROLE_LABEL[role as Role]}`,
  });

  revalidatePath("/settings");
  return { ok: true, message: `Added ${name}.` };
}

export async function changeUserRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!ROLES.includes(role)) return;

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.role === role) return;

  // Don't allow removing the last admin by demotion.
  if (target.role === Role.ADMIN && role !== Role.ADMIN) {
    const admins = await db.user.count({ where: { role: Role.ADMIN } });
    if (admins <= 1) return;
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  await logAudit({
    entityType: "User",
    entityId: userId,
    action: "USER_ROLE_CHANGED",
    actorId: admin.id,
    comment: `${target.name}: ${ROLE_LABEL[target.role as Role]} → ${ROLE_LABEL[role as Role]}`,
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout"); // sidebar/role-gated nav may change
}

export async function removeUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorised." };

  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) return { ok: false, error: "You can't remove your own account." };

  const target = await db.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { projects: true } } },
  });
  if (!target) return { ok: false, error: "User not found." };

  if (target.role === Role.ADMIN) {
    const admins = await db.user.count({ where: { role: Role.ADMIN } });
    if (admins <= 1) return { ok: false, error: "Can't remove the only admin." };
  }
  if (target._count.projects > 0) {
    return {
      ok: false,
      error: `${target.name} owns ${target._count.projects} project(s) — reassign them first.`,
    };
  }

  await db.user.delete({ where: { id: userId } });
  await logAudit({
    entityType: "User",
    entityId: userId,
    action: "USER_REMOVED",
    actorId: admin.id,
    comment: `${target.name} <${target.email}>`,
  });

  revalidatePath("/settings");
  return { ok: true, message: `Removed ${target.name}.` };
}

// --- Organization / automation settings --------------------------------------

export async function saveOrgSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorised." };

  // Notification recipients: comma/newline separated. Blank clears the override (→ env/default).
  const recipientsRaw = String(formData.get("recipients") ?? "");
  const emails = recipientsRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) return { ok: false, error: `Invalid email(s): ${invalid.join(", ")}` };

  const scanStrict = formData.get("scanStrict") != null; // checkbox present ⇒ on

  await setSetting(SETTING_KEYS.NOTIFY_RECIPIENTS, emails.length ? emails.join(",") : null);
  await setSetting(SETTING_KEYS.GMAIL_SCAN_STRICT, scanStrict ? "true" : "false");

  await logAudit({
    entityType: "AppSetting",
    entityId: "org",
    action: "SETTINGS_UPDATED",
    actorId: admin.id,
    comment: `recipients=${emails.length ? emails.join(",") : "(default)"}; scanStrict=${scanStrict}`,
  });

  revalidatePath("/settings");
  return { ok: true, message: "Settings saved." };
}
