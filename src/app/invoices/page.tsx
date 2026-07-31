import Link from "next/link";
import { Mail, FileText, AlertTriangle, CheckCircle2, HelpCircle, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { amountRange } from "@/lib/filters";
import { requireUser, getCurrentUserRecord } from "@/lib/auth";
import { isGmailConnected } from "@/lib/google";
import { aiEnabled } from "@/lib/ai";
import { formatINR } from "@/lib/money";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_CATEGORIES,
  PaymentMode,
  PAYMENT_MODE_LABEL,
  type InvoiceStatus,
} from "@/lib/enums";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  type Tone,
} from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import {
  scanInboxAction,
  resolveInvoiceAction,
  deleteInvoiceAction,
  createManualInvoiceAction,
} from "./actions";

const inputCls =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

const STATUS_TONE: Record<InvoiceStatus, Tone> = {
  VALIDATED: "success",
  FLAGGED: "warning",
  AMBIGUOUS: "info",
  PENDING: "neutral",
};

function parseIssues(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const [record, sp] = await Promise.all([getCurrentUserRecord(), searchParams]);
  const connected = record ? isGmailConnected(record) : false;

  const q = sp.q ?? "";
  const status = sp.status ?? "";
  const filtered = !!q || !!status || !!sp.min || !!sp.max;

  const where: Prisma.InvoiceWhereInput = {};
  if (status) where.status = status;
  const amt = amountRange(sp.min, sp.max);
  if (amt) where.amount = amt;
  if (q) {
    where.OR = [
      { vendor: { name: { contains: q, mode: "insensitive" } } },
      { sourceSubject: { contains: q, mode: "insensitive" } },
      { projectName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [invoices, sheets] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { vendor: true, closingSheet: { include: { project: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.closingSheet.findMany({ include: { project: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const groups: { status: InvoiceStatus; label: string }[] = [
    { status: "AMBIGUOUS", label: "Needs matching" },
    { status: "FLAGGED", label: "Flagged" },
    { status: "VALIDATED", label: "Validated" },
    { status: "PENDING", label: "Pending" },
  ];

  const showScanSummary = sp.scanned !== undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Collected from Gmail, extracted and validated, matched to closing sheets."
        actions={
          connected ? (
            <form action={scanInboxAction}>
              <Button type="submit">
                <Mail size={16} /> Scan my Gmail
              </Button>
            </form>
          ) : (
            <a
              href="/api/auth/google"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Mail size={16} /> Connect Gmail
            </a>
          )
        }
      />

      {!aiEnabled() && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          AI extraction is running in fallback (regex-only) mode. Set <code>AI_PROVIDER</code> and{" "}
          <code>MUAPI_API_KEY</code> for full field extraction.
        </p>
      )}

      {showScanSummary && (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-1 pt-5 text-sm">
            <span className="font-medium">Scan complete.</span>
            <span className="text-muted-foreground">{sp.scanned} scanned</span>
            <span className="text-success">{sp.created} new</span>
            <span className="text-info">{sp.ambiguous} to match</span>
            <span className="text-warning">{sp.flagged} flagged</span>
            <span className="text-muted-foreground">{sp.duplicates} duplicates skipped</span>
            {sp.ignored && Number(sp.ignored) > 0 ? (
              <span className="text-muted-foreground">{sp.ignored} ignored (not shoot invoices)</span>
            ) : null}
          </CardBody>
        </Card>
      )}

      {sheets.length > 0 && (
        <details className="rounded-xl border bg-card">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-sm font-semibold">
            <Plus size={16} /> Add an invoice manually
          </summary>
          <div className="border-t px-5 py-4">
            <p className="mb-3 text-xs text-muted-foreground">
              For invoices Gmail didn&apos;t pick up. Validated against the shoot on save, just like scanned ones.
            </p>
            <form action={createManualInvoiceAction} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Shoot">
                  <select name="closingSheetId" required defaultValue="" className={inputCls}>
                    <option value="" disabled>
                      Select shoot…
                    </option>
                    {sheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.project.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Vendor">
                  <input name="vendorName" required placeholder="Vendor name" className={inputCls} />
                </Field>
                <Field label="Category">
                  <input
                    name="category"
                    list="invoice-categories"
                    placeholder="e.g. Catering"
                    className={inputCls}
                  />
                  <datalist id="invoice-categories">
                    {INVOICE_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Amount ₹">
                  <input name="amount" inputMode="numeric" placeholder="0" className={inputCls} />
                </Field>
                <Field label="PAN">
                  <input name="pan" placeholder="ABCDE1234F" className={inputCls} />
                </Field>
                <Field label="GSTIN">
                  <input name="gstin" placeholder="Optional" className={inputCls} />
                </Field>
                <Field label="Payment mode">
                  <select name="paymentMode" defaultValue="" className={inputCls}>
                    <option value="">Auto</option>
                    {Object.values(PaymentMode).map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_MODE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Shoot date">
                  <input type="date" name="shootDate" className={inputCls} />
                </Field>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="gstApplicable"
                      defaultChecked
                      className="h-4 w-4 accent-primary"
                    />
                    GST applicable
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Attachment (optional)
                    </span>
                    <input
                      type="file"
                      name="attachment"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="block text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
                    />
                  </label>
                </div>
                <Button type="submit">
                  <Plus size={15} /> Add invoice
                </Button>
              </div>
            </form>
          </div>
        </details>
      )}

      {!connected && (
        <EmptyState
          title="Connect Gmail to start scanning"
          description="Revolio reads your inbox (read-only) for shoot invoices and matches them to the right closing sheet automatically."
          action={
            <a
              href="/api/auth/google"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Mail size={16} /> Connect Gmail
            </a>
          }
        />
      )}

      {connected && invoices.length === 0 && !filtered && (
        <EmptyState
          title="No invoices yet"
          description="Hit “Scan my Gmail” to pull recent invoice emails and match them to closing sheets."
        />
      )}

      {(invoices.length > 0 || filtered) && (
        <FilterBar
          path="/invoices"
          q={q}
          status={status}
          placeholder="Search vendor, subject, project…"
          statuses={groups.map((g) => ({ value: g.status, label: g.label }))}
          showAmount
          amountMin={sp.min ?? ""}
          amountMax={sp.max ?? ""}
        />
      )}

      {filtered && invoices.length === 0 && (
        <EmptyState
          title="No matching invoices"
          description="No invoices match these filters. Try a different search or clear the filters."
          action={
            <a
              href="/invoices"
              className="inline-flex h-9 items-center rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"
            >
              Clear filters
            </a>
          }
        />
      )}

      {groups.map(({ status, label }) => {
        const rows = invoices.filter((i) => i.status === status);
        if (rows.length === 0) return null;
        return (
          <section key={status} className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusIcon status={status} />
              <h2 className="text-sm font-semibold">
                {label}{" "}
                <span className="text-muted-foreground">({rows.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {rows.map((inv) => {
                const issues = parseIssues(inv.validationIssues);
                return (
                  <Card key={inv.id}>
                    <CardBody className="pt-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">
                              {inv.vendor?.name ?? inv.sourceSubject ?? "Unknown vendor"}
                            </p>
                            <Badge tone={STATUS_TONE[inv.status as InvoiceStatus] ?? "neutral"}>
                              {INVOICE_STATUS_LABEL[inv.status as InvoiceStatus] ?? inv.status}
                            </Badge>
                            {inv.category && <Badge tone="neutral">{inv.category}</Badge>}
                            {inv.upiEligible && <Badge tone="accent">UPI</Badge>}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {inv.sourceSubject ?? "—"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="font-semibold">{formatINR(inv.amount)}</span>
                            {inv.closingSheet?.project && (
                              <Link
                                href={`/closing-sheets/${inv.closingSheet.id}`}
                                className="text-primary hover:underline"
                              >
                                {inv.closingSheet.project.name}
                              </Link>
                            )}
                            {inv.status === "AMBIGUOUS" && (
                              <span className="text-xs text-muted-foreground">
                                match confidence {inv.matchConfidence ?? 0}%
                              </span>
                            )}
                            {inv.pan && <span className="text-xs text-muted-foreground">PAN {inv.pan}</span>}
                            {inv.gstin && <span className="text-xs text-muted-foreground">GSTIN {inv.gstin}</span>}
                            {inv.fileUrl && (
                              <a
                                href={inv.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <FileText size={13} /> attachment
                              </a>
                            )}
                            <a
                              href={`/api/invoices/${inv.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileText size={13} /> invoice PDF
                            </a>
                          </div>
                          {issues.length > 0 && (
                            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-warning">
                              {issues.map((it, i) => (
                                <li key={i}>{it}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {(inv.status === "AMBIGUOUS" || !inv.closingSheetId) && sheets.length > 0 && (
                            <form action={resolveInvoiceAction} className="flex items-center gap-2">
                              <input type="hidden" name="invoiceId" value={inv.id} />
                              <select
                                name="sheetId"
                                defaultValue=""
                                required
                                className="h-9 rounded-lg border bg-card px-2 text-sm"
                              >
                                <option value="" disabled>
                                  Assign to sheet…
                                </option>
                                {sheets.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.project.name}
                                  </option>
                                ))}
                              </select>
                              <Button type="submit" variant="secondary">
                                Assign
                              </Button>
                            </form>
                          )}
                          <form action={deleteInvoiceAction}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <Button type="submit" variant="ghost" className="text-danger">
                              Discard
                            </Button>
                          </form>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatusIcon({ status }: { status: InvoiceStatus }) {
  if (status === "VALIDATED") return <CheckCircle2 size={16} className="text-success" />;
  if (status === "FLAGGED") return <AlertTriangle size={16} className="text-warning" />;
  if (status === "AMBIGUOUS") return <HelpCircle size={16} className="text-info" />;
  return <FileText size={16} className="text-muted-foreground" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
