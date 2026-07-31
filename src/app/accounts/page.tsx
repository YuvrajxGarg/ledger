import Link from "next/link";
import { format } from "date-fns";
import { Wallet, User2, CalendarDays, CheckCircle2, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { sheetTotals } from "@/lib/sheets";
import {
  REIMBURSEMENT_PAYMENT_MODE_LABEL,
  type ReimbursementPaymentMode,
} from "@/lib/enums";
import { Badge, Button, Card, CardBody, EmptyState, PageHeader } from "@/components/ui";
import { SheetStatusBadge } from "@/components/status-badge";
import { markSheetPaid } from "./actions";
import { markReimbursementPaid } from "../reimbursements/actions";

export default async function AccountsPage() {
  const user = await requireUser();
  const canPay = can(user.role, "markPaid");

  const [sheets, reimbursements, users] = await Promise.all([
    db.closingSheet.findMany({
      where: { status: { in: ["APPROVED", "DISPATCHED"] } },
      include: { project: { include: { producer: true } }, lines: true },
      orderBy: { decidedAt: "desc" },
    }),
    db.reimbursement.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany(),
  ]);

  const userName = (uid: string | null) =>
    (uid && users.find((u) => u.id === uid)?.name) || "—";

  const sheetRows = sheets.map((s) => {
    const total = sheetTotals(s.lines).grand;
    const clearedCount = s.lines.filter((l) => l.cleared === "CLEARED").length;
    const fullyPaid = s.lines.length > 0 && clearedCount === s.lines.length;
    return { sheet: s, total, clearedCount, fullyPaid };
  });

  const outstandingSheets = sheetRows.filter((r) => !r.fullyPaid);
  const outstandingTotal =
    outstandingSheets.reduce((sum, r) => sum + r.total, 0) +
    reimbursements.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Approved closing sheets and reimbursements, ready to pay."
      />

      {!canPay && (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
          View-only — sign in as Accounts or Admin to record payments.
        </p>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-5 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatINR(outstandingTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sheets to pay</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{outstandingSheets.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Reimbursements to pay
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{reimbursements.length}</p>
          </div>
        </CardBody>
      </Card>

      {/* Closing sheets */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Closing sheets{" "}
          <span className="text-muted-foreground">({sheetRows.length})</span>
        </h2>
        {sheetRows.length === 0 ? (
          <EmptyState
            title="Nothing to pay"
            description="Approved closing sheets appear here once producers' sheets clear approval."
          />
        ) : (
          <div className="space-y-3">
            {sheetRows.map(({ sheet, total, clearedCount, fullyPaid }) => (
              <Card key={sheet.id}>
                <CardBody className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/closing-sheets/${sheet.id}`}
                          className="truncate font-medium hover:text-primary"
                        >
                          {sheet.project.name}
                        </Link>
                        <SheetStatusBadge status={sheet.status} />
                        {fullyPaid ? (
                          <Badge tone="success">
                            <CheckCircle2 size={12} /> Paid
                          </Badge>
                        ) : clearedCount > 0 ? (
                          <Badge tone="warning">
                            Partly paid · {clearedCount}/{sheet.lines.length}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                          <Wallet size={14} /> {formatINR(total)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User2 size={13} /> {sheet.project.producer.name}
                        </span>
                        {sheet.project.shootDate && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays size={13} /> {format(sheet.project.shootDate, "d MMM yyyy")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {sheet.lines.length} line{sheet.lines.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {canPay && !fullyPaid && (
                      <form action={markSheetPaid} className="shrink-0">
                        <input type="hidden" name="sheetId" value={sheet.id} />
                        <Button type="submit">Mark paid</Button>
                      </form>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Reimbursements */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Reimbursements{" "}
          <span className="text-muted-foreground">({reimbursements.length})</span>
        </h2>
        {reimbursements.length === 0 ? (
          <EmptyState
            title="No reimbursements to pay"
            description="Approved reimbursements appear here, ready for payout."
          />
        ) : (
          <div className="space-y-3">
            {reimbursements.map((r) => (
              <Card key={r.id}>
                <CardBody className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{r.projectName ?? "Shoot"}</span>
                        <Badge tone="neutral">
                          {REIMBURSEMENT_PAYMENT_MODE_LABEL[
                            r.paymentMode as ReimbursementPaymentMode
                          ] ?? r.paymentMode}
                        </Badge>
                      </div>
                      {r.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                          <Wallet size={14} /> {formatINR(r.amount)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User2 size={13} /> {userName(r.producerId)}
                        </span>
                        {r.date && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays size={13} /> {format(r.date, "d MMM yyyy")}
                          </span>
                        )}
                        {r.receiptUrl && (
                          <a
                            href={r.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileText size={13} /> receipt
                          </a>
                        )}
                      </div>
                    </div>

                    {canPay && (
                      <form action={markReimbursementPaid} className="shrink-0">
                        <input type="hidden" name="reimbId" value={r.id} />
                        <Button type="submit">Mark paid</Button>
                      </form>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
