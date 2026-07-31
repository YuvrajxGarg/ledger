import Link from "next/link";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { sheetTotals } from "@/lib/sheets";
import { SHEET_STATUS_LABEL, SheetStatus } from "@/lib/enums";
import { Card, PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { SheetStatusBadge } from "@/components/status-badge";
import { FilterBar } from "@/components/filter-bar";

export default async function ClosingSheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  const isProducer = user?.role === "PRODUCER";
  const { q = "", status = "" } = await searchParams;

  const where: Prisma.ClosingSheetWhereInput = {};
  if (isProducer) where.project = { producerId: user!.id };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { project: { name: { contains: q, mode: "insensitive" } } },
      { project: { producer: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const sheets = await db.closingSheet.findMany({
    where,
    include: { project: { include: { producer: true } }, lines: true },
    orderBy: { createdAt: "desc" },
  });
  const filtered = !!q || !!status;

  const rows = sheets.map((s) => ({ ...s, totals: sheetTotals(s.lines) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closing Sheets"
        description={
          isProducer ? "Your shoots and their closing sheets." : "All shoots across producers."
        }
        actions={
          <ButtonLink href="/closing-sheets/new">
            <Plus size={16} /> New closing sheet
          </ButtonLink>
        }
      />

      <FilterBar
        path="/closing-sheets"
        q={q}
        status={status}
        placeholder="Search project or producer…"
        statuses={Object.values(SheetStatus).map((s) => ({
          value: s,
          label: SHEET_STATUS_LABEL[s],
        }))}
      />

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No matching closing sheets"
            description="No sheets match these filters. Try a different search or clear the filters."
            action={
              <ButtonLink href="/closing-sheets" variant="secondary">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No closing sheets yet"
            description="Create one for a shoot to begin collecting invoices and start the approval workflow."
            action={
              <ButtonLink href="/closing-sheets/new">
                <Plus size={16} /> New closing sheet
              </ButtonLink>
            }
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Producer</th>
                  <th className="px-5 py-3 font-medium">Shoot date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Lines</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link
                        href={`/closing-sheets/${s.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {s.project.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {s.project.producer.name}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {s.project.shootDate
                        ? format(s.project.shootDate, "d MMM yyyy")
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <SheetStatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {s.lines.length}
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">
                      {formatINR(s.totals.grand)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
