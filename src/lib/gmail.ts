// Gmail invoice scanning. Reads the signed-in producer's inbox (gmail.readonly),
// pulls likely-invoice messages, extracts fields (AI + regex fallback), matches each
// to a closing sheet, upserts the vendor, validates, and persists an Invoice.
// Unmatched/ambiguous invoices are stored with closingSheetId=null for producer resolution.

import fs from "node:fs/promises";
import path from "node:path";
import type { gmail_v1 } from "googleapis";
import { db } from "./db";
import { getGmailClient } from "./google";
import { logAudit } from "./audit";
import {
  extractInvoiceFields,
  matchProject,
  detectDuplicate,
  slugify,
  parseSubjectConvention,
} from "./ai";
import { extractPdfText } from "./pdf";
import { validateInvoice } from "./validation";
import { notifyInvoiceFlagged, notifyInvoiceAmbiguous } from "./notify";

// Likely-invoice messages within the recent window. Tuned to be inclusive; the
// extractor/validator sort out false positives.
// in:inbox so we only scan *received* vendor mail — never the producer's Sent/Drafts.
const SEARCH_QUERY =
  'in:inbox newer_than:120d (subject:(invoice OR bill OR "tax invoice") OR (has:attachment (invoice OR bill OR receipt)))';
const MAX_MESSAGES = 30;

export type ScanSummary = {
  scanned: number;
  created: number;
  matched: number;
  ambiguous: number;
  flagged: number;
  duplicates: number;
  skipped: number;
  ignored: number;
};

// Strict (default): ignore mail that neither matches a shoot nor follows the Revolio
// convention. Set GMAIL_SCAN_STRICT=false to loosen — every candidate then becomes an
// AMBIGUOUS invoice for manual matching (the old, noisier behaviour).
function scanStrict(): boolean {
  return process.env.GMAIL_SCAN_STRICT !== "false";
}

type ScanUser = {
  id: string;
  email: string;
  name: string;
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleTokenExpiry: Date | null;
};

// --- Gmail message helpers ---------------------------------------------------

function header(msg: gmail_v1.Schema$Message, name: string): string {
  const h = msg.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function decodeB64(data?: string | null): string {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}

/** Collect text/plain (fallback: stripped text/html) from a (possibly nested) payload. */
function extractBodyText(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (part: gmail_v1.Schema$MessagePart) => {
    const mime = part.mimeType ?? "";
    if (mime === "text/plain" && part.body?.data) plain.push(decodeB64(part.body.data));
    else if (mime === "text/html" && part.body?.data) html.push(decodeB64(part.body.data));
    part.parts?.forEach(walk);
  };
  walk(payload);
  if (plain.length) return plain.join("\n");
  return html.join("\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

type Attachment = { filename: string; attachmentId: string; mimeType: string };

function findAttachment(payload?: gmail_v1.Schema$MessagePart): Attachment | null {
  if (!payload) return null;
  let found: Attachment | null = null;
  const walk = (part: gmail_v1.Schema$MessagePart) => {
    if (found) return;
    const filename = part.filename ?? "";
    const attachmentId = part.body?.attachmentId ?? "";
    if (filename && attachmentId && /\.(pdf|png|jpe?g|webp)$/i.test(filename)) {
      found = { filename, attachmentId, mimeType: part.mimeType ?? "" };
      return;
    }
    part.parts?.forEach(walk);
  };
  walk(payload);
  return found;
}

async function fetchAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  att: Attachment,
): Promise<Buffer | null> {
  try {
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: att.attachmentId,
    });
    return res.data.data ? Buffer.from(res.data.data, "base64url") : null;
  } catch {
    return null;
  }
}

async function saveAttachmentBuffer(
  messageId: string,
  filename: string,
  buf: Buffer,
): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), "public", "uploads", "invoices");
    await fs.mkdir(dir, { recursive: true });
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const file = `${messageId}-${safe}`;
    await fs.writeFile(path.join(dir, file), buf);
    return `/uploads/invoices/${file}`;
  } catch {
    return null; // best-effort; never block the scan
  }
}

// --- Vendor registry auto-accumulation --------------------------------------

export async function upsertVendor(vendorName: string | null, gstin: string | null, pan: string | null) {
  if (!vendorName) return null;
  const all = await db.vendor.findMany();
  const target = slugify(vendorName);
  const match = all.find((v) => slugify(v.name) === target);
  if (match) {
    // Backfill identifiers we now know.
    if ((gstin && !match.gstin) || (pan && !match.pan)) {
      return db.vendor.update({
        where: { id: match.id },
        data: { gstin: match.gstin ?? gstin ?? undefined, pan: match.pan ?? pan ?? undefined },
      });
    }
    return match;
  }
  return db.vendor.create({
    data: { name: vendorName, gstin: gstin ?? undefined, pan: pan ?? undefined, gstApplicable: !!gstin },
  });
}

// --- Main scan ---------------------------------------------------------------

export async function scanInbox(user: ScanUser): Promise<ScanSummary> {
  const summary: ScanSummary = {
    scanned: 0, created: 0, matched: 0, ambiguous: 0, flagged: 0, duplicates: 0, skipped: 0, ignored: 0,
  };

  const gmail = getGmailClient(user);
  const projects = await db.project.findMany({
    where: { closingSheet: { isNot: null } },
    include: { closingSheet: true, producer: true },
  });

  const list = await gmail.users.messages.list({ userId: "me", q: SEARCH_QUERY, maxResults: MAX_MESSAGES });
  const messages = list.data.messages ?? [];

  for (const m of messages) {
    if (!m.id) continue;
    summary.scanned++;

    // Dedupe on the Gmail message id.
    if (await db.invoice.findFirst({ where: { sourceEmailId: m.id } })) {
      summary.skipped++;
      continue;
    }

    const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
    const msg = full.data;
    const subject = header(msg, "Subject");
    const att = findAttachment(msg.payload);

    // Fetch the attachment once (for PDF text now); saved only if we keep the invoice.
    let attBuf: Buffer | null = null;
    let attText = "";
    if (att) {
      attBuf = await fetchAttachment(gmail, m.id, att);
      if (attBuf && /\.pdf$/i.test(att.filename)) attText = await extractPdfText(attBuf);
    }

    // OCR/vision gap (follow-up, see docs/Roadmap): images and scanned (image-only) PDFs
    // yield no extractable text, so we fall back to subject/body regex. muapi vision needs a
    // publicly reachable image_url, so this only becomes wireable once the app is deployed
    // behind PUBLIC_BASE_URL. Log it so the team can see which invoices under-extracted.
    if (att) {
      const isImage = /\.(png|jpe?g|webp)$/i.test(att.filename);
      const isScannedPdf = /\.pdf$/i.test(att.filename) && attText.trim() === "";
      if (isImage || isScannedPdf) {
        // eslint-disable-next-line no-console
        console.log(
          `[gmail scan] "${att.filename}" has no extractable text — OCR/vision needed; using subject/body fallback.`,
        );
      }
    }

    const bodyText = [msg.snippet ?? "", extractBodyText(msg.payload), attText]
      .filter(Boolean)
      .join("\n");

    const extracted = await extractInvoiceFields({
      subject,
      filename: att?.filename,
      text: bodyText,
    });

    // Match to a project/sheet.
    const match = await matchProject(
      { subject, filename: att?.filename, extracted },
      projects.map((p) => ({ id: p.id, name: p.name, canonicalKey: p.canonicalKey })),
    );
    const project = match.projectId ? projects.find((p) => p.id === match.projectId) ?? null : null;
    const sheetId = project?.closingSheet?.id ?? null;

    // Gate: mail that neither matches a shoot nor follows the Revolio invoice convention
    // (<Category>_Invoice_<Project>_<Month Year>) is noise in a real inbox. Always log it
    // so the team has visibility into what's filtered; only skip when strict (the default).
    // GMAIL_SCAN_STRICT=false rolls back to creating an AMBIGUOUS invoice for each instead.
    const conv = parseSubjectConvention(subject);
    const followsConvention = !!(conv.category || conv.projectToken);
    if (!project && !followsConvention) {
      // eslint-disable-next-line no-console
      console.log(
        `[gmail scan] ${scanStrict() ? "ignored" : "kept (loose)"} — no shoot match, non-convention subject: "${subject}"`,
      );
      if (scanStrict()) {
        summary.ignored++;
        continue;
      }
    }

    // Duplicate check within the matched sheet.
    if (sheetId) {
      const existing = await db.invoice.findMany({
        where: { closingSheetId: sheetId },
        include: { vendor: true },
      });
      const dupId = detectDuplicate(
        { vendorName: extracted.vendorName, amountPaise: extracted.amountPaise, shootDate: extracted.shootDate },
        existing.map((e) => ({ id: e.id, vendorName: e.vendor?.name ?? null, amount: e.amount, shootDate: e.shootDate })),
      );
      if (dupId) {
        summary.duplicates++;
        summary.skipped++;
        continue;
      }
    }

    // Kept — persist the attachment and accumulate the vendor only now.
    const attFileUrl = att && attBuf ? await saveAttachmentBuffer(m.id, att.filename, attBuf) : null;
    const vendor = await upsertVendor(extracted.vendorName, extracted.gstin, extracted.pan);
    const gstApplicable = vendor ? vendor.gstApplicable : !!extracted.gstin;

    // Validate (only meaningful cross-checks when matched to a sheet).
    const validation = project
      ? validateInvoice(
          {
            amountPaise: extracted.amountPaise,
            pan: extracted.pan,
            gstin: extracted.gstin,
            gstApplicable,
            paymentMode: extracted.paymentMode,
            projectName: extracted.projectName,
            shootDate: extracted.shootDate,
            vendorName: extracted.vendorName,
          },
          { projectName: project.name, shootDate: project.shootDate },
        )
      : { status: "FLAGGED" as const, issues: [], upiEligible: false };

    const status = !project ? "AMBIGUOUS" : validation.status;

    const invoice = await db.invoice.create({
      data: {
        closingSheetId: sheetId,
        vendorId: vendor?.id ?? null,
        category: extracted.category,
        projectName: extracted.projectName,
        shootDate: extracted.shootDate,
        amount: extracted.amountPaise ?? 0,
        gstin: extracted.gstin,
        gstApplicable,
        pan: extracted.pan,
        paymentMode: extracted.paymentMode,
        upiEligible: validation.upiEligible,
        status,
        validationIssues: validation.issues.length ? JSON.stringify(validation.issues) : null,
        sourceEmailId: m.id,
        sourceSubject: subject || null,
        matchConfidence: match.confidence,
        fileUrl: attFileUrl,
      },
    });

    summary.created++;
    const label = extracted.vendorName ? `${extracted.vendorName}` : subject || "invoice";

    await logAudit({
      entityType: "Invoice",
      entityId: invoice.id,
      action: status === "AMBIGUOUS" ? "SCANNED_AMBIGUOUS" : status === "FLAGGED" ? "SCANNED_FLAGGED" : "SCANNED_VALIDATED",
      actorId: user.id,
      comment: `${label} · ${subject}`.trim(),
    });

    if (status === "AMBIGUOUS") {
      summary.ambiguous++;
      await notifyInvoiceAmbiguous(invoice.id, label, [user.email]);
    } else if (status === "FLAGGED") {
      summary.flagged++;
      const to = project?.producer?.email ? [project.producer.email] : [user.email];
      await notifyInvoiceFlagged(invoice.id, label, validation.issues, to);
    } else {
      summary.matched++;
    }
  }

  await db.user.update({ where: { id: user.id }, data: { gmailLastScanAt: new Date() } });
  return summary;
}
