"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, getCurrentUserRecord } from "@/lib/auth";
import { isGmailConnected } from "@/lib/google";
import { scanInbox, upsertVendor } from "@/lib/gmail";
import { validateInvoice } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { toPaise } from "@/lib/money";
import { saveUpload } from "@/lib/uploads";
import { UPI_LIMIT_PAISE } from "@/lib/enums";

/** Scan the signed-in user's Gmail. Redirects to connect if not linked yet. */
export async function scanInboxAction() {
  await requireUser();
  const record = await getCurrentUserRecord();
  if (!record) redirect("/login");
  if (!isGmailConnected(record)) redirect("/api/auth/google");

  const summary = await scanInbox({
    id: record.id,
    email: record.email,
    name: record.name,
    googleAccessToken: record.googleAccessToken,
    googleRefreshToken: record.googleRefreshToken,
    googleTokenExpiry: record.googleTokenExpiry,
  });

  const q = new URLSearchParams({
    scanned: String(summary.scanned),
    created: String(summary.created),
    matched: String(summary.matched),
    ambiguous: String(summary.ambiguous),
    flagged: String(summary.flagged),
    duplicates: String(summary.duplicates),
    ignored: String(summary.ignored),
  });
  revalidatePath("/invoices");
  redirect(`/invoices?${q.toString()}`);
}

/** Assign an ambiguous/unmatched invoice to a closing sheet and re-validate it. */
export async function resolveInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId"));
  const sheetId = String(formData.get("sheetId"));
  if (!invoiceId || !sheetId) return;

  const [invoice, sheet] = await Promise.all([
    db.invoice.findUnique({ where: { id: invoiceId }, include: { vendor: true } }),
    db.closingSheet.findUnique({ where: { id: sheetId }, include: { project: true } }),
  ]);
  if (!invoice || !sheet) return;

  const validation = validateInvoice(
    {
      amountPaise: invoice.amount,
      pan: invoice.pan,
      gstin: invoice.gstin,
      gstApplicable: invoice.gstApplicable,
      paymentMode: invoice.paymentMode,
      projectName: invoice.projectName,
      shootDate: invoice.shootDate,
      vendorName: invoice.vendor?.name ?? null,
    },
    { projectName: sheet.project.name, shootDate: sheet.project.shootDate },
  );

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      closingSheetId: sheetId,
      status: validation.status,
      validationIssues: validation.issues.length ? JSON.stringify(validation.issues) : null,
      upiEligible: validation.upiEligible,
      matchConfidence: 100,
    },
  });

  await logAudit({
    entityType: "Invoice",
    entityId: invoiceId,
    action: "MATCHED",
    actorId: user.id,
    comment: `Assigned to ${sheet.project.name}`,
  });

  revalidatePath("/invoices");
  revalidatePath(`/closing-sheets/${sheetId}`);
}

const manualSchema = z.object({
  closingSheetId: z.string().min(1, "Pick a shoot"),
  vendorName: z.string().min(1, "Vendor is required"),
  category: z.string().optional(),
  amount: z.string(),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  gstApplicable: z.boolean(),
  paymentMode: z.string().optional(),
  shootDate: z.string().optional(),
});

/** Add an invoice by hand (e.g. one Gmail scanning didn't pick up), with an optional attachment. */
export async function createManualInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const p = manualSchema.parse({
    closingSheetId: formData.get("closingSheetId"),
    vendorName: formData.get("vendorName"),
    category: (formData.get("category") as string) || undefined,
    amount: (formData.get("amount") as string) || "0",
    pan: (formData.get("pan") as string) || undefined,
    gstin: (formData.get("gstin") as string) || undefined,
    gstApplicable: formData.get("gstApplicable") === "on",
    paymentMode: (formData.get("paymentMode") as string) || undefined,
    shootDate: (formData.get("shootDate") as string) || undefined,
  });

  const amount = toPaise(p.amount);
  if (amount <= 0) return;

  const sheet = await db.closingSheet.findUnique({
    where: { id: p.closingSheetId },
    include: { project: true },
  });
  if (!sheet) return;

  const pan = p.pan?.toUpperCase() || null;
  const gstin = p.gstin?.toUpperCase() || null;
  const shootDate = p.shootDate ? new Date(p.shootDate) : null;

  // Auto-tag payment mode when unspecified (UPI eligibility rule < ₹5,000), like sheet lines.
  const paymentMode =
    p.paymentMode && p.paymentMode !== ""
      ? p.paymentMode
      : amount < UPI_LIMIT_PAISE
        ? "UPI"
        : "NEFT";

  const [vendor, fileUrl] = await Promise.all([
    upsertVendor(p.vendorName, gstin, pan),
    saveUpload(formData.get("attachment"), "invoices"),
  ]);

  const validation = validateInvoice(
    {
      amountPaise: amount,
      pan,
      gstin,
      gstApplicable: p.gstApplicable,
      paymentMode,
      projectName: sheet.project.name,
      shootDate,
      vendorName: p.vendorName,
    },
    { projectName: sheet.project.name, shootDate: sheet.project.shootDate },
  );

  const invoice = await db.invoice.create({
    data: {
      closingSheetId: sheet.id,
      vendorId: vendor?.id ?? null,
      category: p.category ?? null,
      projectName: sheet.project.name,
      shootDate,
      amount,
      gstin,
      gstApplicable: p.gstApplicable,
      pan,
      paymentMode,
      upiEligible: validation.upiEligible,
      status: validation.status,
      validationIssues: validation.issues.length ? JSON.stringify(validation.issues) : null,
      isManual: true,
      sourceSubject: "Manual entry",
      matchConfidence: 100,
      fileUrl,
    },
  });

  await logAudit({
    entityType: "Invoice",
    entityId: invoice.id,
    action: "CREATED",
    actorId: user.id,
    comment: `Manual invoice · ${p.vendorName} · ${sheet.project.name}`,
  });

  revalidatePath("/invoices");
  revalidatePath(`/closing-sheets/${sheet.id}`);
}

/** Discard a scanned message that isn't a real invoice. */
export async function deleteInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId"));
  if (!invoiceId) return;
  await db.invoice.delete({ where: { id: invoiceId } });
  await logAudit({ entityType: "Invoice", entityId: invoiceId, action: "DISCARDED", actorId: user.id });
  revalidatePath("/invoices");
}
