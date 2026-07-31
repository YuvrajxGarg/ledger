import { toPaise } from "./money";

// Build Prisma range clauses from FilterBar query params. Return undefined when empty
// so callers can spread/assign conditionally without adding no-op filters.

export function amountRange(min?: string, max?: string) {
  const r: { gte?: number; lte?: number } = {};
  if (min) r.gte = toPaise(min);
  if (max) r.lte = toPaise(max);
  return "gte" in r || "lte" in r ? r : undefined;
}

export function dateRange(from?: string, to?: string) {
  const r: { gte?: Date; lte?: Date } = {};
  if (from) r.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999); // inclusive of the whole "to" day
    r.lte = end;
  }
  return "gte" in r || "lte" in r ? r : undefined;
}
