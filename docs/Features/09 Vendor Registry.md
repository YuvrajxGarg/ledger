# 09 · Vendor Registry

Builds a vendor database as a byproduct of processing invoices — the user's "eventually automate reminders" idea.

## Phase 1 (now)
Every processed invoice creates/updates a `Vendor` (name, PAN, GST, category, bank/UPI, contact, PoC, shoots
worked, payment history). Purely accumulative + searchable ([[06 Search and Filter]]). Speeds re-matching.

## Phase 2 (later)
- Automated invoice reminders to repeat vendors.
- Prefilled vendor details on new invoices/manual invoices.
- Per-vendor spend analytics + rate anomaly detection (LLM).
