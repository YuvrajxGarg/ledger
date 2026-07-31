import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { q = "" } = await searchParams;

  const where: Prisma.VendorWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { category: { contains: q } },
      { pan: { contains: q } },
    ];
  }

  const vendors = await db.vendor.findMany({
    where,
    include: { _count: { select: { invoices: true, lines: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Auto-built from processed invoices. Powers matching and, later, invoice reminders."
      />

      <FilterBar path="/vendors" q={q} placeholder="Search name, category, PAN…" />

      {vendors.length === 0 ? (
        <EmptyState
          title={q ? "No matching vendors" : "No vendors yet"}
          description={
            q
              ? "No vendors match this search. Try different terms or clear the filter."
              : "Vendors accumulate automatically as invoices are processed."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">PAN</th>
                  <th className="px-5 py-3 font-medium">GST</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 text-right font-medium">Shoots</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">{v.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{v.category ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {v.pan ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {v.gstApplicable ? (
                        <Badge tone="info">{v.gstin ? "Registered" : "Applicable"}</Badge>
                      ) : (
                        <Badge tone="neutral">Exempt</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{v.contact ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {v._count.lines}
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
