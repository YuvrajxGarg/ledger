import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, PageHeader, Button } from "@/components/ui";
import { createClosingSheet } from "../actions";

const inputCls =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";

export default function NewClosingSheetPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/closing-sheets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Back to closing sheets
      </Link>

      <PageHeader
        title="New closing sheet"
        description="Create a sheet for a shoot to start the workflow."
      />

      <Card className="max-w-xl">
        <CardBody className="pt-5">
          <form action={createClosingSheet} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                Shoot / project name
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="e.g. District Culture | Manifesto"
                className={inputCls}
              />
              <p className="text-xs text-muted-foreground">
                Used to match incoming invoices — keep it consistent with what vendors put in the
                invoice subject.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="shootDate" className="text-sm font-medium">
                  Shoot date
                </label>
                <input id="shootDate" name="shootDate" type="date" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="finalBudget" className="text-sm font-medium">
                  Final budget (₹)
                </label>
                <input
                  id="finalBudget"
                  name="finalBudget"
                  inputMode="numeric"
                  placeholder="80,000"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit">Create closing sheet</Button>
              <Link
                href="/closing-sheets"
                className="inline-flex h-9 items-center rounded-lg px-4 text-sm hover:bg-muted"
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
