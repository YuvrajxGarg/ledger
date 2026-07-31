"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toPaise } from "@/lib/money";
import { notifySheetSubmitted, notifySheetDecision } from "@/lib/notify";
import { UPI_LIMIT_PAISE } from "@/lib/enums";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const createSchema = z.object({
  name: z.string().min(2, "Shoot name is required"),
  shootDate: z.string().optional(),
  finalBudget: z.string().optional(),
});

export async function createClosingSheet(formData: FormData) {
  const user = await requireUser();
  const parsed = createSchema.parse({
    name: formData.get("name"),
    shootDate: (formData.get("shootDate") as string) || undefined,
    finalBudget: (formData.get("finalBudget") as string) || undefined,
  });

  let key = slugify(parsed.name);
  if (await db.project.findUnique({ where: { canonicalKey: key } })) {
    key = `${key}-${Date.now().toString(36)}`;
  }

  const project = await db.project.create({
    data: {
      name: parsed.name,
      canonicalKey: key,
      shootDate: parsed.shootDate ? new Date(parsed.shootDate) : null,
      finalBudget: parsed.finalBudget ? toPaise(parsed.finalBudget) : 0,
      producerId: user.id,
      closingSheet: { create: { status: "DRAFT" } },
    },
    include: { closingSheet: true },
  });

  await logAudit({
    entityType: "ClosingSheet",
    entityId: project.closingSheet!.id,
    action: "CREATED",
    actorId: user.id,
  });

  redirect(`/closing-sheets/${project.closingSheet!.id}`);
}

const lineSchema = z.object({
  sheetId: z.string(),
  section: z.enum(["PRODUCTION", "PETTY_CASH"]),
  name: z.string().min(1, "Name is required"),
  particulars: z.string().optional(),
  amount: z.string(),
  paymentMode: z.string().optional(),
});

export async function addLine(formData: FormData) {
  const user = await requireUser();
  const p = lineSchema.parse({
    sheetId: formData.get("sheetId"),
    section: formData.get("section"),
    name: formData.get("name"),
    particulars: (formData.get("particulars") as string) || undefined,
    amount: (formData.get("amount") as string) || "0",
    paymentMode: (formData.get("paymentMode") as string) || undefined,
  });

  const amount = toPaise(p.amount);
  // Auto-tag payment mode when not specified (UPI eligibility rule < ₹5,000).
  const paymentMode =
    p.paymentMode && p.paymentMode !== ""
      ? p.paymentMode
      : amount > 0 && amount < UPI_LIMIT_PAISE
        ? "UPI"
        : "NEFT";

  await db.closingSheetLine.create({
    data: {
      closingSheetId: p.sheetId,
      section: p.section,
      name: p.name,
      particulars: p.particulars ?? null,
      amount,
      paymentMode,
      paidInCash: paymentMode === "COMPANY_CARD",
    },
  });

  await logAudit({
    entityType: "ClosingSheet",
    entityId: p.sheetId,
    action: "LINE_ADDED",
    actorId: user.id,
    comment: `${p.name} · ${p.particulars ?? ""}`.trim(),
  });

  revalidatePath(`/closing-sheets/${p.sheetId}`);
}

export async function deleteLine(formData: FormData) {
  const user = await requireUser();
  const lineId = String(formData.get("lineId"));
  const sheetId = String(formData.get("sheetId"));
  await db.closingSheetLine.delete({ where: { id: lineId } });
  await logAudit({
    entityType: "ClosingSheet",
    entityId: sheetId,
    action: "LINE_REMOVED",
    actorId: user.id,
  });
  revalidatePath(`/closing-sheets/${sheetId}`);
}

export async function submitSheet(formData: FormData) {
  const user = await requireUser();
  const sheetId = String(formData.get("sheetId"));

  const sheet = await db.closingSheet.findUnique({
    where: { id: sheetId },
    include: { project: true, lines: true },
  });
  if (!sheet) return;
  if (sheet.lines.length === 0) return; // nothing to submit

  await db.closingSheet.update({
    where: { id: sheetId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  await logAudit({
    entityType: "ClosingSheet",
    entityId: sheetId,
    action: "SUBMITTED",
    actorId: user.id,
  });
  await notifySheetSubmitted(sheetId, sheet.project.name, user.name);

  revalidatePath(`/closing-sheets/${sheetId}`);
}

export async function decideSheet(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "approve")) return;

  const sheetId = String(formData.get("sheetId"));
  const decision = String(formData.get("decision")) as
    | "APPROVED"
    | "REJECTED"
    | "CHANGES_REQUESTED";
  const comment = (formData.get("comment") as string) || undefined;

  const sheet = await db.closingSheet.findUnique({
    where: { id: sheetId },
    include: { project: true },
  });
  if (!sheet || sheet.status !== "SUBMITTED") return;

  await db.closingSheet.update({
    where: { id: sheetId },
    data: {
      status: decision,
      decidedAt: new Date(),
      decidedById: user.id,
      currentRevision:
        decision === "CHANGES_REQUESTED"
          ? sheet.currentRevision + 1
          : sheet.currentRevision,
    },
  });

  await logAudit({
    entityType: "ClosingSheet",
    entityId: sheetId,
    action: decision,
    actorId: user.id,
    comment,
  });
  await notifySheetDecision(sheetId, sheet.project.name, decision, comment);

  revalidatePath(`/closing-sheets/${sheetId}`);
}
