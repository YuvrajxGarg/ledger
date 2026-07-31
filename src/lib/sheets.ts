// Closing-sheet domain helpers.

export type LineLike = { section: string; amount: number };

export function sheetTotals(lines: LineLike[]) {
  const production = lines
    .filter((l) => l.section === "PRODUCTION")
    .reduce((s, l) => s + l.amount, 0);
  const pettyCash = lines
    .filter((l) => l.section === "PETTY_CASH")
    .reduce((s, l) => s + l.amount, 0);
  return { production, pettyCash, grand: production + pettyCash };
}
