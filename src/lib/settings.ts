// Admin-editable app configuration, backed by the AppSetting key/value table.
// Every value resolves in three tiers: DB row (set on the Settings page) → env var →
// hard default. So an empty table preserves the prior env-driven behaviour, and any
// override is reversible by clearing the row. See docs and the reversible-defaults note.

import { db } from "./db";

export const SETTING_KEYS = {
  NOTIFY_RECIPIENTS: "notify.recipients",
  GMAIL_SCAN_STRICT: "gmail.scanStrict",
} as const;
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// Hard defaults — mirror the fallbacks that lived in notify.ts / gmail.ts.
const DEFAULT_RECIPIENTS = "rishti@revolio.in,yuvraj@revolio.in";

type Source = "db" | "env" | "default";

/** Read every stored setting as a key→value map (unset keys absent). */
async function readStored(): Promise<Map<string, string>> {
  const rows = await db.appSetting.findMany();
  return new Map(rows.map((r) => [r.key, r.value]));
}

function splitEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// --- Typed reads (used by the workflow code) ---------------------------------

/** Notification recipients (DB → NOTIFY_RECIPIENTS → default), de-duped. */
export async function getNotifyRecipients(): Promise<string[]> {
  const stored = (await readStored()).get(SETTING_KEYS.NOTIFY_RECIPIENTS);
  const raw = stored ?? process.env.NOTIFY_RECIPIENTS ?? DEFAULT_RECIPIENTS;
  return Array.from(new Set(splitEmails(raw)));
}

/** Whether Gmail scanning ignores non-matching, non-convention mail (DB → env → true). */
export async function getGmailScanStrict(): Promise<boolean> {
  const stored = (await readStored()).get(SETTING_KEYS.GMAIL_SCAN_STRICT);
  if (stored != null) return stored !== "false";
  return process.env.GMAIL_SCAN_STRICT !== "false";
}

// --- Settings page: effective values + where each came from ------------------

export type EffectiveSettings = {
  notifyRecipients: { value: string[]; source: Source };
  gmailScanStrict: { value: boolean; source: Source };
};

export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const stored = await readStored();

  const recStored = stored.get(SETTING_KEYS.NOTIFY_RECIPIENTS);
  const recSource: Source = recStored != null ? "db" : process.env.NOTIFY_RECIPIENTS ? "env" : "default";
  const recRaw = recStored ?? process.env.NOTIFY_RECIPIENTS ?? DEFAULT_RECIPIENTS;

  const strictStored = stored.get(SETTING_KEYS.GMAIL_SCAN_STRICT);
  const strictSource: Source =
    strictStored != null ? "db" : process.env.GMAIL_SCAN_STRICT != null ? "env" : "default";
  const strictRaw = strictStored ?? process.env.GMAIL_SCAN_STRICT;

  return {
    notifyRecipients: { value: Array.from(new Set(splitEmails(recRaw))), source: recSource },
    gmailScanStrict: { value: strictRaw !== "false", source: strictSource },
  };
}

/**
 * Upsert one setting. `null` deletes the row → the value falls back to env/default,
 * which is how an override is reverted. Callers are responsible for audit logging.
 */
export async function setSetting(key: SettingKey, value: string | null): Promise<void> {
  if (value === null) {
    await db.appSetting.deleteMany({ where: { key } });
    return;
  }
  await db.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
