"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifySheetPaid } from "@/lib/notify";

export async function markSheetPaid(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "markPaid")) return;

  const sheetId = String(formData.get("sheetId"));
  const sheet = await db.closingSheet.findUnique({
    where: { id: sheetId },
    include: { project: true, lines: true },
  });
  if (!sheet) return;
  if (!["APPROVED", "DISPATCHED"].includes(sheet.status)) return; // only payable sheets
  if (sheet.lines.length === 0) return;

  await db.closingSheetLine.updateMany({
    where: { closingSheetId: sheetId },
    data: { cleared: "CLEARED" },
  });

  // Write FINAL ledger entries for each vendor's outstanding balance on this project,
  // so the ledger reflects the payout (advances/partials already logged are netted off).
  const invoices = await db.invoice.findMany({
    where: { closingSheetId: sheetId, vendorId: { not: null } },
  });
  if (invoices.length > 0) {
    const existing = await db.ledgerEntry.findMany({
      where: { projectId: sheet.projectId },
    });
    const invoicedByVendor = new Map<string, number>();
    for (const inv of invoices) {
      invoicedByVendor.set(
        inv.vendorId!,
        (invoicedByVendor.get(inv.vendorId!) ?? 0) + inv.amount,
      );
    }
    const paidByVendor = new Map<string, number>();
    for (const e of existing) {
      paidByVendor.set(e.vendorId, (paidByVendor.get(e.vendorId) ?? 0) + e.amount);
    }
    for (const [vendorId, invoiced] of invoicedByVendor) {
      const balance = invoiced - (paidByVendor.get(vendorId) ?? 0);
      if (balance > 0) {
        await db.ledgerEntry.create({
          data: {
            projectId: sheet.projectId,
            vendorId,
            type: "FINAL",
            amount: balance,
            date: new Date(),
            notes: "Auto: sheet marked paid",
          },
        });
      }
    }
    revalidatePath("/ledger");
  }

  await logAudit({
    entityType: "ClosingSheet",
    entityId: sheetId,
    action: "PAID",
    actorId: user.id,
    comment: "Marked all lines cleared",
  });
  await notifySheetPaid(sheetId, sheet.project.name);

  revalidatePath("/accounts");
  revalidatePath(`/closing-sheets/${sheetId}`);
}
