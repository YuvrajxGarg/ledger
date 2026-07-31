"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toPaise } from "@/lib/money";
import { saveUpload } from "@/lib/uploads";
import {
  notifyReimbursementSubmitted,
  notifyReimbursementDecision,
  notifyReimbursementPaid,
} from "@/lib/notify";

const createSchema = z.object({
  closingSheetId: z.string().min(1, "Pick a shoot"),
  date: z.string().optional(),
  description: z.string().optional(),
  amount: z.string(),
  paymentMode: z.enum(["UPI", "CASH"]).default("UPI"),
});

export async function createReimbursement(formData: FormData) {
  const user = await requireUser();
  const p = createSchema.parse({
    closingSheetId: formData.get("closingSheetId"),
    date: (formData.get("date") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    amount: (formData.get("amount") as string) || "0",
    paymentMode: (formData.get("paymentMode") as string) || "UPI",
  });

  const amount = toPaise(p.amount);
  if (amount <= 0) return; // nothing to log

  const sheet = await db.closingSheet.findUnique({
    where: { id: p.closingSheetId },
    include: { project: true },
  });
  if (!sheet) return;

  const receiptUrl = await saveUpload(formData.get("receipt"), "receipts");

  const reimb = await db.reimbursement.create({
    data: {
      closingSheetId: p.closingSheetId,
      producerId: user.id,
      projectName: sheet.project.name,
      date: p.date ? new Date(p.date) : null,
      description: p.description ?? null,
      amount,
      paymentMode: p.paymentMode,
      receiptUrl,
      status: "SUBMITTED",
    },
  });

  await logAudit({
    entityType: "Reimbursement",
    entityId: reimb.id,
    action: "SUBMITTED",
    actorId: user.id,
    comment: p.description ?? undefined,
  });
  await notifyReimbursementSubmitted(reimb.id, sheet.project.name, user.name);

  revalidatePath("/reimbursements");
}

export async function decideReimbursement(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "approve")) return;

  const id = String(formData.get("reimbId"));
  const decision = String(formData.get("decision")) as
    | "APPROVED"
    | "REJECTED"
    | "CHANGES_REQUESTED";
  const comment = (formData.get("comment") as string) || undefined;

  const reimb = await db.reimbursement.findUnique({ where: { id } });
  if (!reimb || reimb.status !== "SUBMITTED") return;

  await db.reimbursement.update({
    where: { id },
    data: { status: decision, decidedById: user.id },
  });

  await logAudit({
    entityType: "Reimbursement",
    entityId: id,
    action: decision,
    actorId: user.id,
    comment,
  });
  await notifyReimbursementDecision(
    id,
    reimb.projectName ?? "reimbursement",
    decision,
    comment,
  );

  revalidatePath("/reimbursements");
}

export async function resubmitReimbursement(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("reimbId"));

  const reimb = await db.reimbursement.findUnique({ where: { id } });
  if (!reimb) return;
  const isOwner = reimb.producerId === user.id;
  if (!isOwner && user.role !== "ADMIN") return;
  if (!["CHANGES_REQUESTED", "REJECTED"].includes(reimb.status)) return;

  await db.reimbursement.update({
    where: { id },
    data: { status: "SUBMITTED", decidedById: null },
  });

  await logAudit({
    entityType: "Reimbursement",
    entityId: id,
    action: "SUBMITTED",
    actorId: user.id,
    comment: "Resubmitted for approval",
  });
  await notifyReimbursementSubmitted(
    id,
    reimb.projectName ?? "reimbursement",
    user.name,
  );

  revalidatePath("/reimbursements");
}

export async function markReimbursementPaid(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "markPaid")) return;

  const id = String(formData.get("reimbId"));
  const reimb = await db.reimbursement.findUnique({ where: { id } });
  if (!reimb || reimb.status !== "APPROVED") return;

  await db.reimbursement.update({ where: { id }, data: { status: "PAID" } });

  await logAudit({
    entityType: "Reimbursement",
    entityId: id,
    action: "PAID",
    actorId: user.id,
  });
  await notifyReimbursementPaid(id, reimb.projectName ?? "reimbursement");

  revalidatePath("/reimbursements");
}

export async function deleteReimbursement(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("reimbId"));

  const reimb = await db.reimbursement.findUnique({ where: { id } });
  if (!reimb) return;
  const isOwner = reimb.producerId === user.id;
  if (!isOwner && user.role !== "ADMIN") return;
  if (reimb.status === "PAID") return; // paid items are a permanent record

  await db.reimbursement.delete({ where: { id } });

  await logAudit({
    entityType: "Reimbursement",
    entityId: id,
    action: "REMOVED",
    actorId: user.id,
  });

  revalidatePath("/reimbursements");
}
