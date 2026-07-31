# 01 · Closing Sheet

The unit of work — one per project/shoot. Aggregate root ([[../Data Model]]).

## What
Producer creates a sheet (shoot name, date, final budget), fills lines in two sections (**Production Costs**,
**Petty Cash Expenses**), attaches invoices, then submits for approval.

## Fields (mirrors District Manifesto template)
Line: Name · Particulars · Amount · Paid in Cash · Advance · Invoice/Bills · Notes · Cleared.
Footer: Sub-totals per section → Grand Total → Less GST → Total (excl. GST).

## Status lifecycle
`DRAFT → SUBMITTED → (APPROVED | CHANGES_REQUESTED → DRAFT… | REJECTED) → DISPATCHED`

## Permissions
Producer: own sheets. Senior Producer: all + approve/dispatch. Accounts: view approved + mark paid. Admin: all.

## Related
[[03 Validation Engine]] · [[04 Approval Workflow]] · [[07 Accounts Dispatch]] · [[11 Ledger]]
