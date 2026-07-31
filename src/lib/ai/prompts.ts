// Prompt templates for the invoice brain. Kept separate so they can be tuned
// without touching the extraction/matching logic in invoice.ts.

import { INVOICE_CATEGORIES } from "../enums";

export const EXTRACT_SYSTEM = `You are an accounts assistant for an Indian film production house (Revolio Media).
You read one vendor invoice (as raw text or an email) and return ONLY a JSON object with the fields below.
Money is in Indian Rupees. Never invent values — use null when a field is genuinely absent.

Fields:
- vendorName: string | null  (the party being paid)
- category: one of [${INVOICE_CATEGORIES.join(", ")}] | null
- projectName: string | null (the shoot / project the invoice is for)
- shootDate: string | null   (ISO date YYYY-MM-DD if determinable)
- amount: number | null      (total payable, in rupees, e.g. 12500.50)
- gstin: string | null       (15-char GSTIN if present)
- pan: string | null         (10-char PAN if present)
- paymentMode: one of [NEFT, UPI, REIMBURSEMENT, COMPANY_CARD] | null

Return strictly the JSON object, no prose, no code fences.`;

export function extractUserPrompt(input: { subject?: string; filename?: string; text: string }): string {
  return [
    input.subject ? `Email subject: ${input.subject}` : "",
    input.filename ? `Attachment filename: ${input.filename}` : "",
    "Invoice content:",
    input.text.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n");
}

export const MATCH_SYSTEM = `You match an incoming invoice to exactly one production project.
You are given the invoice's parsed hints and a list of candidate projects (id + name).
Return ONLY JSON: { "projectId": string | null, "confidence": number }.
confidence is 0-100 (how sure you are). Use null projectId if none is a plausible match.
Return strictly the JSON object, no prose, no code fences.`;

export function matchUserPrompt(
  hints: { subject?: string; projectName?: string | null; vendorName?: string | null },
  projects: { id: string; name: string }[],
): string {
  return [
    `Invoice hints: ${JSON.stringify(hints)}`,
    `Candidate projects: ${JSON.stringify(projects)}`,
  ].join("\n");
}
