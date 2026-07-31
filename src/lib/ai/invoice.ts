// High-level invoice brain: field extraction, project matching, duplicate detection.
// Every function has a deterministic (regex / string-similarity) path so it works with
// AI_PROVIDER=mock or when a live call fails — the LLM is an enhancement, not a hard dep.

import { z } from "zod";
import { toPaise } from "../money";
import { INVOICE_CATEGORIES, PaymentMode } from "../enums";
import { aiEnabled, chat, extractJson } from "./client";
import {
  EXTRACT_SYSTEM,
  extractUserPrompt,
  MATCH_SYSTEM,
  matchUserPrompt,
} from "./prompts";

export type ExtractedInvoice = {
  vendorName: string | null;
  category: string | null;
  projectName: string | null;
  shootDate: Date | null;
  amountPaise: number | null;
  gstin: string | null;
  pan: string | null;
  paymentMode: PaymentMode | null;
  source: "ai" | "regex";
};

const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/;
// Revolio convention: "<Category>_Invoice_<Project>_<Month Year>"
const SUBJECT_RE = /^\s*([A-Za-z ]+?)[_\s-]+invoice[_\s-]+(.+?)[_\s-]+([A-Za-z]+\s*\d{4})\s*$/i;

const PAYMENT_MODES = Object.values(PaymentMode);

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normCategory(c?: string | null): string | null {
  if (!c) return null;
  const hit = INVOICE_CATEGORIES.find((k) => k.toLowerCase() === c.trim().toLowerCase());
  return hit ?? null;
}

function normPaymentMode(m?: string | null): PaymentMode | null {
  if (!m) return null;
  const up = m.trim().toUpperCase().replace(/\s+/g, "_");
  return (PAYMENT_MODES as string[]).includes(up) ? (up as PaymentMode) : null;
}

/** Parse the "<Category>_Invoice_<Project>_<Month Year>" subject convention. */
export function parseSubjectConvention(subject?: string): {
  category: string | null;
  projectToken: string | null;
  period: string | null;
} {
  if (!subject) return { category: null, projectToken: null, period: null };
  const m = subject.match(SUBJECT_RE);
  if (!m) return { category: null, projectToken: null, period: null };
  return {
    category: normCategory(m[1]),
    projectToken: m[2].trim(),
    period: m[3].trim(),
  };
}

const aiSchema = z.object({
  vendorName: z.string().nullish(),
  category: z.string().nullish(),
  projectName: z.string().nullish(),
  shootDate: z.string().nullish(),
  amount: z.number().nullish(),
  gstin: z.string().nullish(),
  pan: z.string().nullish(),
  paymentMode: z.string().nullish(),
});

function regexExtract(input: { subject?: string; filename?: string; text: string }): ExtractedInvoice {
  const hay = `${input.subject ?? ""}\n${input.filename ?? ""}\n${input.text ?? ""}`;
  const conv = parseSubjectConvention(input.subject);

  // Amount: prefer a value near "total"/"grand total", else the largest rupee figure.
  let amountPaise: number | null = null;
  const totalLine = hay.match(/(?:grand\s*total|total|amount\s*payable)[^0-9]{0,20}(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (totalLine) {
    amountPaise = toPaise(totalLine[1]);
  } else {
    const nums = [...hay.matchAll(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => toPaise(m[1]));
    if (nums.length) amountPaise = Math.max(...nums);
  }

  const pan = hay.match(PAN_RE)?.[0] ?? null;
  const gstin = hay.match(GSTIN_RE)?.[0] ?? null;

  return {
    vendorName: null,
    category: conv.category,
    projectName: conv.projectToken,
    shootDate: null,
    amountPaise: amountPaise && amountPaise > 0 ? amountPaise : null,
    gstin,
    pan,
    paymentMode: null,
    source: "regex",
  };
}

/** Extract structured fields from an invoice (email text / attachment text). */
export async function extractInvoiceFields(input: {
  subject?: string;
  filename?: string;
  text: string;
}): Promise<ExtractedInvoice> {
  const fallback = regexExtract(input);
  if (!aiEnabled()) return fallback;

  try {
    const raw = await chat({
      system: EXTRACT_SYSTEM,
      user: extractUserPrompt(input),
      json: true,
    });
    const parsed = aiSchema.parse(extractJson(raw));
    let shootDate: Date | null = null;
    if (parsed.shootDate) {
      const d = new Date(parsed.shootDate);
      if (!Number.isNaN(d.getTime())) shootDate = d;
    }
    return {
      vendorName: parsed.vendorName?.trim() || null,
      category: normCategory(parsed.category) ?? fallback.category,
      projectName: parsed.projectName?.trim() || fallback.projectName,
      shootDate,
      amountPaise:
        typeof parsed.amount === "number" && parsed.amount > 0
          ? toPaise(parsed.amount)
          : fallback.amountPaise,
      gstin: parsed.gstin?.trim() || fallback.gstin,
      pan: parsed.pan?.trim().toUpperCase() || fallback.pan,
      paymentMode: normPaymentMode(parsed.paymentMode),
      source: "ai",
    };
  } catch {
    // Any network / parse failure → deterministic result. Never block the pipeline.
    return fallback;
  }
}

// --- Project matching --------------------------------------------------------

type ProjectLite = { id: string; name: string; canonicalKey: string };

export type MatchResult = {
  projectId: string | null;
  confidence: number; // 0-100
  candidates: string[]; // ids of plausible matches (for AMBIGUOUS)
};

/** Token-overlap similarity (0-1) between two names. */
function similarity(a: string, b: string): number {
  const ta = new Set(slugify(a).split("-").filter(Boolean));
  const tb = new Set(slugify(b).split("-").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

/** Match an invoice to a project: convention first, then name similarity, then LLM. */
export async function matchProject(
  input: { subject?: string; filename?: string; extracted: ExtractedInvoice },
  projects: ProjectLite[],
): Promise<MatchResult> {
  if (!projects.length) return { projectId: null, confidence: 0, candidates: [] };

  // 1) Subject/filename convention → canonicalKey exact/prefix match.
  const conv = parseSubjectConvention(input.subject) ;
  const token = conv.projectToken ?? input.extracted.projectName ?? null;
  if (token) {
    const slug = slugify(token);
    const exact = projects.find((p) => p.canonicalKey === slug);
    if (exact) return { projectId: exact.id, confidence: 95, candidates: [exact.id] };
    const prefix = projects.filter((p) => p.canonicalKey.startsWith(slug) || slug.startsWith(p.canonicalKey));
    if (prefix.length === 1) return { projectId: prefix[0].id, confidence: 88, candidates: [prefix[0].id] };
  }

  // 2) Name similarity scoring against the extracted / token names.
  const probe = token ?? input.extracted.projectName ?? input.subject ?? "";
  const scored = projects
    .map((p) => ({ p, score: similarity(probe, p.name) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && best.score >= 0.6) {
    const close = scored.filter((s) => best.score - s.score < 0.15 && s.score >= 0.6);
    if (close.length === 1) {
      return { projectId: best.p.id, confidence: Math.round(best.score * 90), candidates: [best.p.id] };
    }
    // Multiple similar → ambiguous; let the LLM (or the producer) break the tie.
  }

  // 3) LLM fuzzy fallback.
  if (aiEnabled()) {
    try {
      const raw = await chat({
        system: MATCH_SYSTEM,
        user: matchUserPrompt(
          { subject: input.subject, projectName: input.extracted.projectName, vendorName: input.extracted.vendorName },
          projects.map((p) => ({ id: p.id, name: p.name })),
        ),
        json: true,
      });
      const r = z
        .object({ projectId: z.string().nullish(), confidence: z.number().nullish() })
        .parse(extractJson(raw));
      if (r.projectId && projects.some((p) => p.id === r.projectId)) {
        return { projectId: r.projectId, confidence: Math.min(100, Math.max(0, r.confidence ?? 60)), candidates: [r.projectId] };
      }
    } catch {
      /* fall through to ambiguous */
    }
  }

  // 4) Ambiguous: surface the plausible candidates for producer resolution.
  const candidates = scored.filter((s) => s.score >= 0.3).slice(0, 4).map((s) => s.p.id);
  return { projectId: null, confidence: best ? Math.round(best.score * 100) : 0, candidates };
}

// --- Duplicate detection -----------------------------------------------------

type ExistingInvoice = {
  id: string;
  vendorName?: string | null;
  amount: number; // paise
  shootDate?: Date | null;
};

/** Same vendor + same amount (and, if both dated, within a week) ⇒ likely duplicate. */
export function detectDuplicate(
  candidate: { vendorName?: string | null; amountPaise: number | null; shootDate?: Date | null },
  existing: ExistingInvoice[],
): string | null {
  if (!candidate.amountPaise) return null;
  const cVendor = candidate.vendorName ? slugify(candidate.vendorName) : null;
  for (const e of existing) {
    if (e.amount !== candidate.amountPaise) continue;
    const eVendor = e.vendorName ? slugify(e.vendorName) : null;
    const vendorMatch = cVendor && eVendor ? cVendor === eVendor : true;
    if (!vendorMatch) continue;
    if (candidate.shootDate && e.shootDate) {
      const days = Math.abs(candidate.shootDate.getTime() - e.shootDate.getTime()) / 86_400_000;
      if (days > 7) continue;
    }
    return e.id;
  }
  return null;
}
