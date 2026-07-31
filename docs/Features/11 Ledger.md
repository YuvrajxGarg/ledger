# 11 · Advance & Partial Payment Ledger

Per **vendor per project** ledger so accounts sees the *net payable*, not just invoice totals.

## Entry types
`ADVANCE` (upfront) · `PARTIAL` (instalment) · `FINAL` (balance) · `REIMBURSEMENT` (producer reclaim).

## Derived
- Per-vendor status on the sheet: **Unpaid / Partially Paid / Fully Paid** (maps to Cleared/Not Cleared).
- Balance due = invoice total − (advances + partials logged).
- Accounts view shows **net payable**.

## Audit
All advance/partial payments logged with dates. Marking paid in [[08 Payment Loop]] writes ledger entries.
