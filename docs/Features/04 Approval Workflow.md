# 04 · Approval Workflow

## Flow
Producer submits closing sheet → Senior Producer gets request (§7 #1) → **Approve / Reject / Request Changes**
(with comments). Rejection/changes → back to producer, **unlimited revisions**. Producer sees real-time status.

## Transitions
`SUBMITTED → APPROVED` · `SUBMITTED → CHANGES_REQUESTED → DRAFT` · `SUBMITTED → REJECTED`
Each transition: `logAudit(...)` + `notify*()` (§7 #2).

## Reimbursements
Approved **independently** of the sheet, same Approve/Reject/Changes semantics — see [[10 Reimbursements]].

## Audit
Every action timestamped with actor + optional comment; surfaced on the sheet detail page.
