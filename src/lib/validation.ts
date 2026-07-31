// Invoice validation engine (PRODUCT_BRIEF §3 / docs/Features/03 Validation Engine).
// Validates *presence & structure* against the Revolio format. GST arithmetic is
// intentionally out of scope until accounts confirms the calc rules — we only check
// that GST identifiers are present when applicable. TDS is not deducted (removed).

import { UPI_LIMIT_PAISE, PaymentMode } from "./enums";
import { slugify } from "./ai/invoice";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const PAYMENT_MODES = Object.values(PaymentMode) as string[];

export type ValidationInput = {
  amountPaise: number | null;
  pan: string | null;
  gstin: string | null;
  gstApplicable: boolean;
  paymentMode: string | null;
  projectName: string | null;
  shootDate: Date | null;
  vendorName: string | null;
};

export type ValidationContext = {
  projectName: string;
  shootDate: Date | null;
};

export type ValidationResult = {
  status: "VALIDATED" | "FLAGGED";
  issues: string[];
  upiEligible: boolean;
};

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(slugify(a).split("-").filter(Boolean));
  const tb = new Set(slugify(b).split("-").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export function validateInvoice(input: ValidationInput, ctx: ValidationContext): ValidationResult {
  const issues: string[] = [];

  // Amount
  if (!input.amountPaise || input.amountPaise <= 0) {
    issues.push("Missing or unreadable invoice amount");
  }

  // PAN — mandatory
  const pan = input.pan?.toUpperCase() ?? null;
  if (!pan) issues.push("Missing PAN (mandatory)");
  else if (!PAN_RE.test(pan)) issues.push("PAN format looks invalid");

  // GST — presence only (calc rules TBD). Skip when the vendor is GST-exempt.
  if (input.gstApplicable) {
    const gstin = input.gstin?.toUpperCase() ?? null;
    if (!gstin) issues.push("Missing GSTIN (GST applicable)");
    else if (!GSTIN_RE.test(gstin)) issues.push("GSTIN format looks invalid");
  }

  // Payment mode
  if (!input.paymentMode) {
    issues.push("Payment mode not specified");
  } else if (!PAYMENT_MODES.includes(input.paymentMode)) {
    issues.push(`Unknown payment mode: ${input.paymentMode}`);
  }

  // Cross-check project name against the closing sheet.
  if (input.projectName && tokenOverlap(input.projectName, ctx.projectName) < 0.34) {
    issues.push(`Invoice project "${input.projectName}" doesn't match sheet "${ctx.projectName}"`);
  }

  // Cross-check shoot date (soft: only if both known and >30 days apart).
  if (input.shootDate && ctx.shootDate) {
    const days = Math.abs(input.shootDate.getTime() - ctx.shootDate.getTime()) / 86_400_000;
    if (days > 30) issues.push("Invoice date is far from the shoot date");
  }

  const upiEligible = !!input.amountPaise && input.amountPaise > 0 && input.amountPaise < UPI_LIMIT_PAISE;

  return {
    status: issues.length === 0 ? "VALIDATED" : "FLAGGED",
    issues,
    upiEligible,
  };
}
