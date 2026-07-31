import Link from "next/link";
import { format } from "date-fns";
import { Send, User2, CalendarDays, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { sheetTotals } from "@/lib/sheets";
import { BATCH_TYPE_LABEL, type BatchType } from "@/lib/enums";
import { Badge, Button, Card, CardBody, EmptyState, PageHeader } from "@/components/ui";
import { createDispatch } from "./actions";

const inputCls =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

function parseIds(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default async function DispatchPage() {
  const user = await requireUser();
  const canDispatch = can(user.role, "dispatch");

  const [approved, dispatches, allSheets, users] = await Promise.all([
    db.closingSheet.findMany({
      where: { status: "APPROVED" },
      include: { project: { include: { producer: true } }, lines: true },
      orderBy: { decidedAt: "desc" },
    }),
    db.dispatch.findMany({ orderBy: { triggeredAt: "desc" } }),
    db.closingSheet.findMany({ include: { project: true } }),
    db.user.findMany(),
  ]);

  const sheetName = (id: string) =>
    allSheets.find((s) => s.id === id)?.project.name ?? "Unknown sheet";
  const userName = (uid: string) => users.find((u) => u.id === uid)?.name ?? "Someone";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description="Push approved closing sheets to accounts in clearly labelled batches."
      />

      {!canDispatch && (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
          Only Senior Producers and Admins can dispatch batches to accounts.
        </p>
      )}

      {/* New dispatch */}
      {canDispatch &&
        (approved.length === 0 ? (
          <EmptyState
            title="No approved sheets ready to dispatch"
            description="Closing sheets appear here once they clear approval. Dispatched sheets move to the Accounts queue."
          />
        ) : (
          <Card>
            <div className="border-b bg-muted/40 px-5 py-3">
              <h2 className="text-sm font-semibold">
                New dispatch{" "}
                <span className="text-muted-foreground">({approved.length} approved)</span>
              </h2>
            </div>
            <form action={createDispatch}>
              <ul className="divide-y">
                {approved.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <input
                      type="checkbox"
                      name="sheetIds"
                      value={s.id}
                      defaultChecked
                      className="h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.project.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <User2 size={12} /> {s.project.producer.name}
                        </span>
                        {s.project.shootDate && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays size={12} /> {format(s.project.shootDate, "d MMM yyyy")}
                          </span>
                        )}
                        <span>
                          {s.lines.length} line{s.lines.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatINR(sheetTotals(s.lines).grand)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3 border-t bg-muted/20 px-5 py-4">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Batch</span>
                  <select name="batchType" defaultValue="MONTH_END" className={inputCls}>
                    {(Object.keys(BATCH_TYPE_LABEL) as BatchType[]).map((t) => (
                      <option key={t} value={t}>
                        {BATCH_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block flex-1 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Note</span>
                  <input name="notes" placeholder="Optional" className={inputCls} />
                </label>
                <Button type="submit">
                  <Send size={15} /> Dispatch to accounts
                </Button>
              </div>
            </form>
          </Card>
        ))}

      {/* Dispatch log */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Dispatch log <span className="text-muted-foreground">({dispatches.length})</span>
        </h2>
        {dispatches.length === 0 ? (
          <EmptyState
            title="No dispatches yet"
            description="Each batch you send to accounts is logged here — who, when, and what it included."
          />
        ) : (
          <div className="space-y-3">
            {dispatches.map((d) => {
              const ids = parseIds(d.includedSheetIds);
              return (
                <Card key={d.id}>
                  <CardBody className="pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">
                          {BATCH_TYPE_LABEL[d.batchType as BatchType] ?? d.batchType}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {ids.length} sheet{ids.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {userName(d.triggeredById)} · {format(d.triggeredAt, "d MMM yyyy, h:mm a")}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {ids.map((id) => (
                        <li key={id} className="text-sm">
                          <Link
                            href={`/closing-sheets/${id}`}
                            className="hover:text-primary"
                          >
                            {sheetName(id)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {d.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">“{d.notes}”</p>
                    )}
                    <a
                      href={`/api/dispatch/${d.id}/summary`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <FileText size={13} /> Summary PDF
                    </a>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
