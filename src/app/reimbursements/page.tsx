import Link from "next/link";
import { format } from "date-fns";
import { Wallet, User2, CalendarDays, FileText } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { amountRange, dateRange } from "@/lib/filters";
import {
  REIMBURSEMENT_STATUS_LABEL,
  REIMBURSEMENT_PAYMENT_MODE_LABEL,
  ReimbursementStatus as ReimbursementStatusEnum,
  type ReimbursementPaymentMode,
  type ReimbursementStatus,
} from "@/lib/enums";
import { Badge, Button, Card, CardBody, EmptyState, PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ReimbursementStatusBadge } from "@/components/status-badge";
import {
  createReimbursement,
  decideReimbursement,
  resubmitReimbursement,
  markReimbursementPaid,
  deleteReimbursement,
} from "./actions";

const inputCls =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

const GROUPS: { status: ReimbursementStatus; label: string }[] = [
  { status: "SUBMITTED", label: "Awaiting approval" },
  { status: "CHANGES_REQUESTED", label: "Changes requested" },
  { status: "APPROVED", label: "Approved — ready to pay" },
  { status: "PAID", label: "Paid" },
  { status: "REJECTED", label: "Rejected" },
];

export default async function ReimbursementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const isProducer = user.role === "PRODUCER";
  const canCreate = user.role === "PRODUCER" || user.role === "ADMIN";
  const canApprove = can(user.role, "approve");
  const canPay = can(user.role, "markPaid");

  const sp = await searchParams;
  const { q = "", status = "" } = sp;
  const filtered = !!q || !!status || !!sp.min || !!sp.max || !!sp.from || !!sp.to;

  const where: Prisma.ReimbursementWhereInput = {};
  if (isProducer) where.producerId = user.id;
  if (status) where.status = status;
  const amt = amountRange(sp.min, sp.max);
  if (amt) where.amount = amt;
  const dr = dateRange(sp.from, sp.to);
  if (dr) where.date = dr;
  if (q) {
    where.OR = [
      { projectName: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const [reimbursements, sheets, users] = await Promise.all([
    db.reimbursement.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    db.closingSheet.findMany({
      where: isProducer ? { project: { producerId: user.id } } : undefined,
      include: { project: true },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany(),
  ]);

  const userName = (uid: string | null) =>
    (uid && users.find((u) => u.id === uid)?.name) || "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursements"
        description="Producers' out-of-pocket shoot expenses, approved independently of the closing sheet."
      />

      <FilterBar
        path="/reimbursements"
        q={q}
        placeholder="Search project or description…"
        status={status}
        statuses={Object.values(ReimbursementStatusEnum).map((s) => ({
          value: s,
          label: REIMBURSEMENT_STATUS_LABEL[s],
        }))}
        showAmount
        amountMin={sp.min ?? ""}
        amountMax={sp.max ?? ""}
        showDates
        dateFrom={sp.from ?? ""}
        dateTo={sp.to ?? ""}
      />

      {canCreate &&
        (sheets.length > 0 ? (
          <Card>
            <div className="border-b bg-muted/40 px-5 py-3">
              <h2 className="text-sm font-semibold">Log an expense</h2>
            </div>
            <CardBody className="pt-4">
              <form action={createReimbursement} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.6fr_0.9fr_0.8fr] lg:items-end">
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
                  <Field label="Date">
                    <input type="date" name="date" className={inputCls} />
                  </Field>
                  <Field label="Description">
                    <input
                      name="description"
                      placeholder="What was this for?"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Amount ₹">
                    <input name="amount" inputMode="numeric" placeholder="0" className={inputCls} />
                  </Field>
                  <Field label="Pay via">
                    <select name="paymentMode" defaultValue="UPI" className={inputCls}>
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </Field>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <Field label="Receipt (optional)">
                    <input
                      type="file"
                      name="receipt"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="block text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
                    />
                  </Field>
                  <Button type="submit">Log expense</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        ) : (
          <EmptyState
            title="No shoots to log against"
            description="Reimbursements attach to a closing sheet. Create a closing sheet for your shoot first."
            action={
              <Link
                href="/closing-sheets/new"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                New closing sheet
              </Link>
            }
          />
        ))}

      {reimbursements.length === 0 ? (
        <EmptyState
          title={filtered ? "No matching reimbursements" : "No reimbursements yet"}
          description={
            filtered
              ? "No reimbursements match these filters. Try different terms or clear the filters."
              : canCreate
                ? "Log an out-of-pocket expense above to start the approval workflow."
                : "Producers' logged expenses will appear here for approval."
          }
        />
      ) : (
        GROUPS.map(({ status, label }) => {
          const rows = reimbursements.filter((r) => r.status === status);
          if (rows.length === 0) return null;
          return (
            <section key={status} className="space-y-3">
              <h2 className="text-sm font-semibold">
                {label} <span className="text-muted-foreground">({rows.length})</span>
              </h2>
              <div className="space-y-3">
                {rows.map((r) => {
                  const isOwner = r.producerId === user.id;
                  return (
                    <Card key={r.id}>
                      <CardBody className="pt-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium">
                                {r.projectName ?? "Shoot"}
                              </span>
                              <ReimbursementStatusBadge status={r.status} />
                              <Badge tone="neutral">
                                {REIMBURSEMENT_PAYMENT_MODE_LABEL[
                                  r.paymentMode as ReimbursementPaymentMode
                                ] ?? r.paymentMode}
                              </Badge>
                            </div>
                            {r.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {r.description}
                              </p>
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
                              {r.decidedById && (
                                <span className="text-xs text-muted-foreground">
                                  Decided by {userName(r.decidedById)}
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

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {canApprove && r.status === "SUBMITTED" && (
                              <form
                                action={decideReimbursement}
                                className="flex flex-col items-end gap-2"
                              >
                                <input type="hidden" name="reimbId" value={r.id} />
                                <input
                                  name="comment"
                                  placeholder="Optional note…"
                                  className="h-9 w-48 rounded-lg border bg-card px-2 text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button type="submit" name="decision" value="APPROVED">
                                    Approve
                                  </Button>
                                  <Button
                                    type="submit"
                                    name="decision"
                                    value="CHANGES_REQUESTED"
                                    variant="secondary"
                                  >
                                    Changes
                                  </Button>
                                  <Button
                                    type="submit"
                                    name="decision"
                                    value="REJECTED"
                                    variant="danger"
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </form>
                            )}

                            {canPay && r.status === "APPROVED" && (
                              <form action={markReimbursementPaid}>
                                <input type="hidden" name="reimbId" value={r.id} />
                                <Button type="submit">Mark paid</Button>
                              </form>
                            )}

                            {isOwner &&
                              ["CHANGES_REQUESTED", "REJECTED"].includes(r.status) && (
                                <form action={resubmitReimbursement}>
                                  <input type="hidden" name="reimbId" value={r.id} />
                                  <Button type="submit" variant="secondary">
                                    Resubmit
                                  </Button>
                                </form>
                              )}

                            {(isOwner || user.role === "ADMIN") && r.status !== "PAID" && (
                              <form action={deleteReimbursement}>
                                <input type="hidden" name="reimbId" value={r.id} />
                                <Button type="submit" variant="ghost" className="text-danger">
                                  Discard
                                </Button>
                              </form>
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
