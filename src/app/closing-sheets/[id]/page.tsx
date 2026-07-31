import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CalendarDays,
  Wallet,
  User2,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { sheetTotals } from "@/lib/sheets";
import {
  SECTION_LABEL,
  PAYMENT_MODE_LABEL,
  INVOICE_STATUS_LABEL,
  PaymentMode,
  type Section,
  type InvoiceStatus,
} from "@/lib/enums";
import { Card, CardBody, Button, Badge, type Tone } from "@/components/ui";
import { SheetStatusBadge } from "@/components/status-badge";
import { addLine, deleteLine, submitSheet, decideSheet } from "../actions";

const inputCls =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

const INVOICE_STATUS_TONE: Record<InvoiceStatus, Tone> = {
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

const ACTION_LABEL: Record<string, string> = {
  CREATED: "created the sheet",
  LINE_ADDED: "added a line",
  LINE_REMOVED: "removed a line",
  SUBMITTED: "submitted for approval",
  APPROVED: "approved the sheet",
  REJECTED: "rejected the sheet",
  CHANGES_REQUESTED: "requested changes",
};

export default async function ClosingSheetDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const sheet = await db.closingSheet.findUnique({
    where: { id },
    include: {
      project: { include: { producer: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!sheet) notFound();

  const [audit, users, invoices] = await Promise.all([
    db.auditLog.findMany({
      where: { entityType: "ClosingSheet", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany(),
    db.invoice.findMany({
      where: { closingSheetId: id },
      include: { vendor: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const userName = (uid: string) => users.find((u) => u.id === uid)?.name ?? "Someone";

  const totals = sheetTotals(sheet.lines);
  const fullyPaid =
    sheet.lines.length > 0 && sheet.lines.every((l) => l.cleared === "CLEARED");
  const isOwner = user?.id === sheet.project.producerId;
  const isAdmin = user?.role === "ADMIN";
  const editableStatus = ["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(sheet.status);
  const canEdit = editableStatus && (isOwner || isAdmin);
  const canSubmit = canEdit && sheet.lines.length > 0;
  const canDecide = !!user && can(user.role, "approve") && sheet.status === "SUBMITTED";

  const sections: Section[] = ["PRODUCTION", "PETTY_CASH"];

  return (
    <div className="space-y-6">
      <Link
        href="/closing-sheets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Back to closing sheets
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{sheet.project.name}</h1>
            <SheetStatusBadge status={sheet.status} />
            {fullyPaid && (
              <Badge tone="success">
                <CheckCircle2 size={12} /> Paid
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User2 size={14} /> {sheet.project.producer.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} />{" "}
              {sheet.project.shootDate
                ? format(sheet.project.shootDate, "d MMM yyyy")
                : "No shoot date"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wallet size={14} /> Budget {formatINR(sheet.project.finalBudget)}
            </span>
            {sheet.currentRevision > 1 && (
              <Badge tone="warning">Revision {sheet.currentRevision}</Badge>
            )}
          </div>
        </div>

        {canSubmit && (
          <form action={submitSheet}>
            <input type="hidden" name="sheetId" value={sheet.id} />
            <Button type="submit">Submit for approval</Button>
          </form>
        )}
      </div>

      {/* Approval panel */}
      {canDecide && (
        <Card className="border-info/40 bg-info-soft/40">
          <CardBody className="pt-5">
            <p className="text-sm font-semibold">Review &amp; decision</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Approve, request changes, or reject. Comments are shared with the producer.
            </p>
            <form action={decideSheet} className="mt-3 space-y-3">
              <input type="hidden" name="sheetId" value={sheet.id} />
              <textarea
                name="comment"
                rows={2}
                placeholder="Optional comment…"
                className={inputCls}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="decision" value="APPROVED">
                  Approve
                </Button>
                <Button
                  type="submit"
                  name="decision"
                  value="CHANGES_REQUESTED"
                  variant="secondary"
                >
                  Request changes
                </Button>
                <Button type="submit" name="decision" value="REJECTED" variant="danger">
                  Reject
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Sheet sections */}
      {sections.map((section) => {
        const lines = sheet.lines.filter((l) => l.section === section);
        const subtotal = lines.reduce((s, l) => s + l.amount, 0);
        return (
          <Card key={section} className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                {SECTION_LABEL[section]}
              </h2>
              <span className="text-sm font-medium tabular-nums">{formatINR(subtotal)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Name</th>
                    <th className="px-5 py-2.5 font-medium">Particulars</th>
                    <th className="px-5 py-2.5 font-medium">Payment</th>
                    <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                    {canEdit && <th className="px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEdit ? 5 : 4}
                        className="px-5 py-6 text-center text-sm text-muted-foreground"
                      >
                        No lines yet.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="px-5 py-3 font-medium">{l.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {l.particulars ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {l.paymentMode ? (
                              <Badge tone="neutral">
                                {PAYMENT_MODE_LABEL[l.paymentMode as PaymentMode] ??
                                  l.paymentMode}
                              </Badge>
                            ) : (
                              "—"
                            )}
                            {l.cleared === "CLEARED" && (
                              <Badge tone="success">
                                <CheckCircle2 size={12} /> Paid
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                          {formatINR(l.amount)}
                        </td>
                        {canEdit && (
                          <td className="px-3 py-3 text-right">
                            <form action={deleteLine}>
                              <input type="hidden" name="lineId" value={l.id} />
                              <input type="hidden" name="sheetId" value={sheet.id} />
                              <button
                                type="submit"
                                aria-label="Remove line"
                                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger"
                              >
                                <Trash2 size={14} />
                              </button>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div className="border-t bg-muted/20 px-5 py-3">
                <form
                  action={addLine}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1.2fr_1fr_0.8fr_auto]"
                >
                  <input type="hidden" name="sheetId" value={sheet.id} />
                  <input type="hidden" name="section" value={section} />
                  <input name="name" required placeholder="Name" className={inputCls} />
                  <input name="particulars" placeholder="Particulars" className={inputCls} />
                  <select name="paymentMode" className={inputCls} defaultValue="">
                    <option value="">Auto</option>
                    {Object.values(PaymentMode).map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_MODE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                  <input
                    name="amount"
                    inputMode="numeric"
                    placeholder="Amount ₹"
                    className={inputCls}
                  />
                  <Button type="submit" variant="secondary">
                    <Plus size={15} /> Add
                  </Button>
                </form>
              </div>
            )}
          </Card>
        );
      })}

      {/* Totals */}
      <Card className="max-w-sm ml-auto">
        <CardBody className="space-y-2 pt-5 text-sm">
          <Row label="Production costs" value={formatINR(totals.production)} />
          <Row label="Petty cash" value={formatINR(totals.pettyCash)} />
          <div className="my-1 border-t" />
          <Row label="Grand total" value={formatINR(totals.grand)} strong />
          <Row label="Less: GST" value="—" muted />
          <Row label="Total (excl. GST)" value={formatINR(totals.grand)} strong />
        </CardBody>
      </Card>

      {/* Invoices */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Invoices{" "}
          {invoices.length > 0 && (
            <span className="text-muted-foreground">({invoices.length})</span>
          )}
        </h2>
        <Card>
          <CardBody className="pt-5">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invoices on this sheet yet. Scanned Gmail invoices that match this shoot appear
                here automatically, or add one manually from the Invoices screen.
              </p>
            ) : (
              <ul className="space-y-3">
                {invoices.map((inv) => {
                  const issues = parseIssues(inv.validationIssues);
                  return (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">
                            {inv.vendor?.name ?? inv.sourceSubject ?? "Unknown vendor"}
                          </span>
                          <Badge tone={INVOICE_STATUS_TONE[inv.status as InvoiceStatus] ?? "neutral"}>
                            {INVOICE_STATUS_LABEL[inv.status as InvoiceStatus] ?? inv.status}
                          </Badge>
                          {inv.category && <Badge tone="neutral">{inv.category}</Badge>}
                          {inv.upiEligible && <Badge tone="accent">UPI</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="font-semibold tabular-nums">
                            {formatINR(inv.amount)}
                          </span>
                          {inv.pan && (
                            <span className="text-xs text-muted-foreground">PAN {inv.pan}</span>
                          )}
                          {inv.gstin && (
                            <span className="text-xs text-muted-foreground">GSTIN {inv.gstin}</span>
                          )}
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
                        </div>
                        {issues.length > 0 && (
                          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-warning">
                            {issues.map((it, i) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Audit trail */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Audit trail</h2>
        <Card>
          <CardBody className="pt-5">
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {audit.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div>
                      <span className="font-medium">{userName(a.actorId)}</span>{" "}
                      <span className="text-muted-foreground">
                        {ACTION_LABEL[a.action] ?? a.action.toLowerCase()}
                      </span>
                      {a.comment && (
                        <span className="text-muted-foreground"> — “{a.comment}”</span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {format(a.createdAt, "d MMM, h:mm a")}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span
        className={`tabular-nums ${strong ? "font-semibold" : ""} ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
