import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { getNotifyRecipients } from "./settings";

// Email notification layer. Real SMTP when configured (SMTP_URL or SMTP_HOST/…), otherwise
// a console preview transport for dev. Either way a Notification row is persisted. Each
// workflow event calls one helper below (PRODUCT_BRIEF §7). See docs/Features/05 Notifications.md.

// Recipients are admin-editable on the Settings page (falls back to NOTIFY_RECIPIENTS,
// then a hard default). Resolved per-send so a change takes effect without a restart.
const recipients = getNotifyRecipients;

// undefined = not yet resolved; null = no SMTP configured (use console transport).
let cachedTransport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (cachedTransport !== undefined) return cachedTransport;
  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  if (url) {
    cachedTransport = nodemailer.createTransport(url);
  } else if (host) {
    cachedTransport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    cachedTransport = null;
  }
  return cachedTransport;
}

function fromAddress(): string {
  return process.env.SMTP_FROM || "Revolio <no-reply@revolio.in>";
}

/** Deliver one email. Returns whether it was sent (or logged) without error. */
async function deliver(to: string, subject: string, body: string): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    // DEV transport — console preview.
    // eslint-disable-next-line no-console
    console.log(`\n📧 [notify] To: ${to}\n   Subject: ${subject}\n   ${body}\n`);
    return true;
  }
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text: body });
    return true;
  } catch (err) {
    // Never let a mail failure break the workflow — log and record it as FAILED.
    // eslint-disable-next-line no-console
    console.error(`[notify] SMTP send failed for ${to}:`, err);
    return false;
  }
}

async function notify(params: {
  type: string;
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  to?: string[];
}) {
  const to = params.to?.length ? params.to : await recipients();
  for (const email of to) {
    const ok = await deliver(email, params.subject, params.body);
    await db.notification.create({
      data: {
        type: params.type,
        recipientEmail: email,
        subject: params.subject,
        body: params.body,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
        status: ok ? "SENT" : "FAILED",
      },
    });
  }
}

// --- Trigger helpers (§7) ----------------------------------------------------

export function notifySheetSubmitted(sheetId: string, projectName: string, producer: string) {
  return notify({
    type: "SHEET_SUBMITTED",
    subject: `Approval needed: ${projectName}`,
    body: `${producer} submitted the closing sheet for "${projectName}". Please review.`,
    relatedEntityType: "ClosingSheet",
    relatedEntityId: sheetId,
  });
}

export function notifySheetDecision(
  sheetId: string,
  projectName: string,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  comment?: string,
) {
  const verb =
    decision === "APPROVED" ? "approved" : decision === "REJECTED" ? "rejected" : "sent back with changes";
  return notify({
    type: `SHEET_${decision}`,
    subject: `Closing sheet ${verb}: ${projectName}`,
    body: `Your closing sheet for "${projectName}" was ${verb}.${comment ? `\n   Note: ${comment}` : ""}`,
    relatedEntityType: "ClosingSheet",
    relatedEntityId: sheetId,
  });
}

export function notifyInvoiceFlagged(
  invoiceId: string,
  label: string,
  issues: string[],
  to?: string[],
) {
  return notify({
    type: "INVOICE_FLAGGED",
    subject: `Invoice needs attention: ${label}`,
    body: `A scanned invoice (${label}) was flagged during validation:\n   - ${issues.join("\n   - ")}`,
    relatedEntityType: "Invoice",
    relatedEntityId: invoiceId,
    to,
  });
}

export function notifyInvoiceAmbiguous(invoiceId: string, label: string, to?: string[]) {
  return notify({
    type: "INVOICE_AMBIGUOUS",
    subject: `Pick a shoot for invoice: ${label}`,
    body: `A scanned invoice (${label}) couldn't be matched to a closing sheet with confidence. Please assign it.`,
    relatedEntityType: "Invoice",
    relatedEntityId: invoiceId,
    to,
  });
}

export function notifySheetPaid(sheetId: string, projectName: string) {
  return notify({
    type: "SHEET_PAID",
    subject: `Payment done: ${projectName}`,
    body: `Accounts has marked the closing sheet for "${projectName}" as paid. All lines are now cleared.`,
    relatedEntityType: "ClosingSheet",
    relatedEntityId: sheetId,
  });
}

export function notifyReimbursementSubmitted(
  reimbId: string,
  projectName: string,
  producer: string,
) {
  return notify({
    type: "REIMB_SUBMITTED",
    subject: `Reimbursement to approve: ${projectName}`,
    body: `${producer} logged a reimbursement against "${projectName}". Please review and approve.`,
    relatedEntityType: "Reimbursement",
    relatedEntityId: reimbId,
  });
}

export function notifyReimbursementDecision(
  reimbId: string,
  projectName: string,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  comment?: string,
) {
  const verb =
    decision === "APPROVED"
      ? "approved"
      : decision === "REJECTED"
        ? "rejected"
        : "sent back with changes";
  return notify({
    type: `REIMB_${decision}`,
    subject: `Reimbursement ${verb}: ${projectName}`,
    body: `Your reimbursement for "${projectName}" was ${verb}.${comment ? `\n   Note: ${comment}` : ""}`,
    relatedEntityType: "Reimbursement",
    relatedEntityId: reimbId,
  });
}

export function notifyReimbursementPaid(reimbId: string, projectName: string) {
  return notify({
    type: "REIMB_PAID",
    subject: `Reimbursement paid: ${projectName}`,
    body: `Your reimbursement for "${projectName}" has been marked paid by accounts.`,
    relatedEntityType: "Reimbursement",
    relatedEntityId: reimbId,
  });
}

export function notifyWrapUpReminder(pendingCount: number) {
  return notify({
    type: "WRAPUP_REMINDER",
    subject: `Month-end approaching — ${pendingCount} closing sheet${pendingCount === 1 ? "" : "s"} still open`,
    body: `Reminder to wrap up submissions: ${pendingCount} closing sheet(s) are still in draft or need changes. Please finalise and submit before the month-end dispatch to accounts.`,
    relatedEntityType: "ClosingSheet",
  });
}

export function notifyMonthEndEscalation(projectNames: string[]) {
  const list = projectNames.map((n) => `- ${n}`).join("\n   ");
  return notify({
    type: "MONTH_END_ESCALATION",
    subject: `Escalation: ${projectNames.length} closing sheet${projectNames.length === 1 ? "" : "s"} unresolved at month-end`,
    body: `These closing sheets are still not approved at month-end and need attention:\n   ${list}`,
    relatedEntityType: "ClosingSheet",
  });
}

export function notifyDispatch(batchLabel: string, sheetCount: number, dispatchId: string) {
  return notify({
    type: "DISPATCH",
    subject: `${batchLabel} dispatched to accounts (${sheetCount} sheet${sheetCount === 1 ? "" : "s"})`,
    body: `A ${batchLabel} was dispatched to accounts with ${sheetCount} approved closing sheet(s).`,
    relatedEntityType: "Dispatch",
    relatedEntityId: dispatchId,
  });
}
