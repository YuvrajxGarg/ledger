// Money is stored as integer paise everywhere. Never use floats in the DB.

/** Format paise as Indian rupees, e.g. 7550000 -> "₹75,500". */
export function formatINR(paise: number, opts?: { withPaise?: boolean }): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: opts?.withPaise ? 2 : 0,
    maximumFractionDigits: opts?.withPaise ? 2 : 0,
  }).format(rupees);
}

/** Parse a rupee string/number ("75,500" or "75500.50") into integer paise. */
export function toPaise(input: string | number): number {
  const n =
    typeof input === "number"
      ? input
      : Number(String(input).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
