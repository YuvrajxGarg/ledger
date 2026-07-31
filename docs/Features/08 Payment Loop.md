# 08 · Payment Confirmation Loop

## What
Accounts logs in, sees approved closing sheets + reimbursements, marks invoices/reimbursements **Paid**.
No edit access to anything else. Producer auto-notified on payment (§7 #9, #13).

## Effect
Marking paid updates the [[11 Ledger]] (creates FINAL/PARTIAL entries) → per-vendor status flips toward
Fully Paid, and the closing sheet line's `cleared` flag updates.
