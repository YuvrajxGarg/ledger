// Ledger domain helpers. A vendor's per-project balance = what they were invoiced
// minus what's already been paid out (advance + partial + final ledger entries).

export type LedgerStatus = "UNPAID" | "PARTIAL" | "PAID";

export const LEDGER_STATUS_LABEL: Record<LedgerStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Fully paid",
};

/** Derive a vendor's payment status from amounts (paise). */
export function ledgerStatus(invoiced: number, paid: number): LedgerStatus {
  if (invoiced <= 0) return paid > 0 ? "PARTIAL" : "UNPAID";
  if (paid <= 0) return "UNPAID";
  return paid >= invoiced ? "PAID" : "PARTIAL";
}
