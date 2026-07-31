import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "./ui";

const fieldCls =
  "h-9 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

// Server-rendered GET filter bar. Submitting navigates to `?q=…&status=…&min=…&…`; the
// page reads those searchParams and builds the Prisma `where`. No client JS involved.
// Status select, amount range, and date range are each opt-in.
export function FilterBar({
  path,
  q,
  placeholder = "Search…",
  status = "",
  statuses,
  showAmount = false,
  amountMin = "",
  amountMax = "",
  showDates = false,
  dateFrom = "",
  dateTo = "",
}: {
  path: string;
  q: string;
  placeholder?: string;
  status?: string;
  statuses?: { value: string; label: string }[];
  showAmount?: boolean;
  amountMin?: string;
  amountMax?: string;
  showDates?: boolean;
  dateFrom?: string;
  dateTo?: string;
}) {
  const active =
    !!q || !!status || !!amountMin || !!amountMax || !!dateFrom || !!dateTo;
  return (
    <form method="get" action={path} className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className={`${fieldCls} w-56 pl-9`}
        />
      </div>

      {statuses && statuses.length > 0 && (
        <select name="status" defaultValue={status} className={fieldCls}>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {showAmount && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <input
            name="min"
            defaultValue={amountMin}
            inputMode="numeric"
            placeholder="Min ₹"
            className={`${fieldCls} w-24`}
          />
          <span>–</span>
          <input
            name="max"
            defaultValue={amountMax}
            inputMode="numeric"
            placeholder="Max ₹"
            className={`${fieldCls} w-24`}
          />
        </div>
      )}

      {showDates && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <input name="from" type="date" defaultValue={dateFrom} className={fieldCls} />
          <span>–</span>
          <input name="to" type="date" defaultValue={dateTo} className={fieldCls} />
        </div>
      )}

      <Button type="submit" variant="secondary">
        Filter
      </Button>
      {active && (
        <Link href={path} className="text-sm text-muted-foreground hover:text-foreground">
          Clear
        </Link>
      )}
    </form>
  );
}
