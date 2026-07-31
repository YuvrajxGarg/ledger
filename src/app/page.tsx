import Link from "next/link";
import { Plus, FileText, Clock3, CheckCircle2, IndianRupee } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { sheetTotals } from "@/lib/sheets";
import { Card, CardBody, PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { SheetStatusBadge } from "@/components/status-badge";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const isProducer = user?.role === "PRODUCER";

  const sheets = await db.closingSheet.findMany({
    where: isProducer ? { project: { producerId: user!.id } } : undefined,
    include: { project: { include: { producer: true } }, lines: true },
    orderBy: { createdAt: "desc" },
  });

  const withTotals = sheets.map((s) => ({ ...s, totals: sheetTotals(s.lines) }));
  const pending = withTotals.filter((s) => s.status === "SUBMITTED");
  const approved = withTotals.filter(
    (s) => s.status === "APPROVED" || s.status === "DISPATCHED",
  );
  const approvedValue = approved.reduce((sum, s) => sum + s.totals.grand, 0);

  const stats = [
    { label: "Closing sheets", value: String(withTotals.length), icon: FileText, tone: "text-info" },
    { label: "Pending approval", value: String(pending.length), icon: Clock3, tone: "text-warning" },
    { label: "Approved", value: String(approved.length), icon: CheckCircle2, tone: "text-success" },
    { label: "Approved value", value: formatINR(approvedValue), icon: IndianRupee, tone: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "there"}`}
        description="Post-shoot expense management — from invoice to accounts payable."
        actions={
          <ButtonLink href="/closing-sheets/new">
            <Plus size={16} /> New closing sheet
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardBody className="pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <Icon size={18} className={s.tone} />
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent closing sheets</h2>
          <Link href="/closing-sheets" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>

        {withTotals.length === 0 ? (
          <EmptyState
            title="No closing sheets yet"
            description="Create a closing sheet for a shoot to start the workflow."
            action={
              <ButtonLink href="/closing-sheets/new">
                <Plus size={16} /> New closing sheet
              </ButtonLink>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Producer</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {withTotals.slice(0, 6).map((s) => (
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
                      <td className="px-5 py-3">
                        <SheetStatusBadge status={s.status} />
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
      </section>
    </div>
  );
}
