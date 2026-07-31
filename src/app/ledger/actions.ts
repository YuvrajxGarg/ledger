"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toPaise } from "@/lib/money";

const schema = z.object({
  projectId: z.string().min(1, "Pick a project"),
  vendorId: z.string().min(1, "Pick a vendor"),
  type: z.enum(["ADVANCE", "PARTIAL", "FINAL", "REIMBURSEMENT"]),
  amount: z.string(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export async function logLedgerEntry(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "markPaid")) return;

  const p = schema.parse({
    projectId: formData.get("projectId"),
    vendorId: formData.get("vendorId"),
    type: formData.get("type"),
    amount: (formData.get("amount") as string) || "0",
    date: (formData.get("date") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });

  const amount = toPaise(p.amount);
  if (amount <= 0) return;

  const entry = await db.ledgerEntry.create({
    data: {
      projectId: p.projectId,
      vendorId: p.vendorId,
      type: p.type,
      amount,
      date: p.date ? new Date(p.date) : new Date(),
      notes: p.notes ?? null,
    },
  });

  await logAudit({
    entityType: "LedgerEntry",
    entityId: entry.id,
    action: p.type,
    actorId: user.id,
    comment: p.notes ?? undefined,
  });

  revalidatePath("/ledger");
}

export async function deleteLedgerEntry(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "markPaid")) return;

  const id = String(formData.get("entryId"));
  const entry = await db.ledgerEntry.findUnique({ where: { id } });
  if (!entry) return;

  await db.ledgerEntry.delete({ where: { id } });
  await logAudit({
    entityType: "LedgerEntry",
    entityId: id,
    action: "REMOVED",
    actorId: user.id,
  });

  revalidatePath("/ledger");
}
