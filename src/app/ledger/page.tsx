import { format } from "date-fns";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import {
  LEDGER_TYPE_LABEL,
  type LedgerType,
} from "@/lib/enums";
import {
  ledgerStatus,
  LEDGER_STATUS_LABEL,
  type LedgerStatus,
} from "@/lib/ledger";
import { Badge, Button, Card, CardBody, EmptyState, PageHeader, type Tone } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { logLedgerEntry, deleteLedgerEntry } from "./actions";

const inputCls =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

const STATUS_TONE: Record<LedgerStatus, Tone> = {
  UNPAID: "warning",
  PARTIAL: "info",
  PAID: "success",
};

type Entry = { id: string; type: string; amount: number; date: Date; notes: string | null };
type VendorRoll = {
  vendorId: string;
  vendorName: string;
  invoiced: number;
  paid: number;
  entries: Entry[];
};
type ProjectRoll = {
  projectId: string;
  projectName: string;
  vendors: Map<string, VendorRoll>;
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const canEdit = can(user.role, "markPaid");
  const { q = "" } = await searchParams;

  const [invoices, entries, projects, vendors] = await Promise.all([
    db.invoice.findMany({
      where: { vendorId: { not: null }, closingSheetId: { not: null } },
      include: { vendor: true, closingSheet: { include: { project: true } } },
    }),
    db.ledgerEntry.findMany({
      include: { vendor: true, project: true },
      orderBy: { date: "asc" },
    }),
    db.project.findMany({
      where: { closingSheet: { isNot: null } },
      orderBy: { name: "asc" },
    }),
    db.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Roll up owed (from invoices) + paid (from ledger entries), keyed project → vendor.
  const rolls = new Map<string, ProjectRoll>();
  const project = (id: string, name: string): ProjectRoll => {
    let r = rolls.get(id);
    if (!r) {
      r = { projectId: id, projectName: name, vendors: new Map() };
      rolls.set(id, r);
    }
    return r;
  };
  const vendorRoll = (pr: ProjectRoll, vid: string, vname: string): VendorRoll => {
    let v = pr.vendors.get(vid);
    if (!v) {
      v = { vendorId: vid, vendorName: vname, invoiced: 0, paid: 0, entries: [] };
      pr.vendors.set(vid, v);
    }
    return v;
  };

  for (const inv of invoices) {
    if (!inv.closingSheet?.project || !inv.vendor) continue;
    const pr = project(inv.closingSheet.project.id, inv.closingSheet.project.name);
    vendorRoll(pr, inv.vendor.id, inv.vendor.name).invoiced += inv.amount;
  }
  for (const e of entries) {
    const pr = project(e.project.id, e.project.name);
    const v = vendorRoll(pr, e.vendor.id, e.vendor.name);
    v.paid += e.amount;
    v.entries.push({ id: e.id, type: e.type, amount: e.amount, date: e.date, notes: e.notes });
  }

  const projectRollsAll = [...rolls.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );
  // Post-rollup text filter: match a project name (keep all its vendors) or drill to
  // matching vendor rows within a project.
  const needle = q.trim().toLowerCase();
  const projectRolls = needle
    ? projectRollsAll
        .map((pr): ProjectRoll | null => {
          if (pr.projectName.toLowerCase().includes(needle)) return pr;
          const vendors = new Map(
            [...pr.vendors].filter(([, v]) =>
              v.vendorName.toLowerCase().includes(needle),
            ),
          );
          return vendors.size ? { ...pr, vendors } : null;
        })
        .filter((x): x is ProjectRoll => x !== null)
    : projectRollsAll;
  const grandOutstanding = projectRolls.reduce(
    (sum, pr) =>
      sum +
      [...pr.vendors.values()].reduce((s, v) => s + Math.max(0, v.invoiced - v.paid), 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger"
        description="Advance, partial and final payments per vendor per project — the net payable, not just invoice totals."
      />

      <FilterBar path="/ledger" q={q} placeholder="Search project or vendor…" />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-5 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net outstanding</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatINR(grandOutstanding)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Projects</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{projectRolls.length}</p>
          </div>
        </CardBody>
      </Card>

      {canEdit && projects.length > 0 && vendors.length > 0 && (
        <Card>
          <div className="border-b bg-muted/40 px-5 py-3">
            <h2 className="text-sm font-semibold">Log a payment</h2>
          </div>
          <CardBody className="pt-4">
            <form
              action={logLedgerEntry}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.3fr_0.9fr_0.8fr_0.9fr_1.2fr_auto] lg:items-end"
            >
              <Field label="Project">
                <select name="projectId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Select…
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vendor">
                <select name="vendorId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Select…
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select name="type" defaultValue="ADVANCE" className={inputCls}>
                  {(Object.keys(LEDGER_TYPE_LABEL) as LedgerType[]).map((t) => (
                    <option key={t} value={t}>
                      {LEDGER_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount ₹">
                <input name="amount" inputMode="numeric" placeholder="0" className={inputCls} />
              </Field>
              <Field label="Date">
                <input type="date" name="date" className={inputCls} />
              </Field>
              <Field label="Note">
                <input name="notes" placeholder="Optional" className={inputCls} />
              </Field>
              <Button type="submit">Log</Button>
            </form>
          </CardBody>
        </Card>
      )}

      {projectRolls.length === 0 ? (
        <EmptyState
          title={needle ? "No matching ledger entries" : "No ledger activity yet"}
          description={
            needle
              ? "No project or vendor matches this search. Try different terms or clear the filter."
              : "Vendor balances build up from matched invoices and the advance/partial/final payments logged against them."
          }
        />
      ) : (
        projectRolls.map((pr) => {
          const vendorList = [...pr.vendors.values()].sort((a, b) =>
            a.vendorName.localeCompare(b.vendorName),
          );
          const projInvoiced = vendorList.reduce((s, v) => s + v.invoiced, 0);
          const projPaid = vendorList.reduce((s, v) => s + v.paid, 0);
          return (
            <Card key={pr.projectId} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-5 py-3">
                <h2 className="text-sm font-semibold">{pr.projectName}</h2>
                <span className="text-xs text-muted-foreground">
                  Invoiced {formatINR(projInvoiced)} · Paid {formatINR(projPaid)} · Balance{" "}
                  <span className="font-medium text-foreground">
                    {formatINR(Math.max(0, projInvoiced - projPaid))}
                  </span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Vendor</th>
                      <th className="px-5 py-2.5 font-medium">Payments</th>
                      <th className="px-5 py-2.5 text-right font-medium">Invoiced</th>
                      <th className="px-5 py-2.5 text-right font-medium">Paid</th>
                      <th className="px-5 py-2.5 text-right font-medium">Balance</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorList.map((v) => {
                      const balance = v.invoiced - v.paid;
                      const status = ledgerStatus(v.invoiced, v.paid);
                      return (
                        <tr key={v.vendorId} className="border-b align-top last:border-0">
                          <td className="px-5 py-3 font-medium">{v.vendorName}</td>
                          <td className="px-5 py-3">
                            {v.entries.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <ul className="space-y-1">
                                {v.entries.map((e) => (
                                  <li
                                    key={e.id}
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <Badge tone="neutral">
                                      {LEDGER_TYPE_LABEL[e.type as LedgerType] ?? e.type}
                                    </Badge>
                                    <span className="tabular-nums">{formatINR(e.amount)}</span>
                                    <span>{format(e.date, "d MMM")}</span>
                                    {e.notes && <span className="truncate">· {e.notes}</span>}
                                    {canEdit && (
                                      <form action={deleteLedgerEntry} className="inline">
                                        <input type="hidden" name="entryId" value={e.id} />
                                        <button
                                          type="submit"
                                          className="text-muted-foreground hover:text-danger"
                                          aria-label="Remove entry"
                                        >
                                          ×
                                        </button>
                                      </form>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {formatINR(v.invoiced)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {formatINR(v.paid)}
                          </td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums">
                            {formatINR(Math.max(0, balance))}
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={STATUS_TONE[status]}>
                              {LEDGER_STATUS_LABEL[status]}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
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
