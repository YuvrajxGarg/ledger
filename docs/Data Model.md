# Data Model

Prisma schema lives in `web/prisma/schema.prisma`. This note is the human-readable map. Money = **integer paise**.

## Entities

### User
`id, name, email (unique), role, createdAt`
`role ∈ { PRODUCER, SENIOR_PRODUCER, ACCOUNTS, ADMIN }`

### Project
One shoot. `id, name, canonicalKey (unique, slug for matching), shootDate, finalBudget, producerId → User, createdAt`

### ClosingSheet — **aggregate root**
1:1 with Project. `id, projectId (unique), status, currentRevision, submittedAt, decidedAt, decidedById, createdAt`
`status ∈ { DRAFT, SUBMITTED, CHANGES_REQUESTED, APPROVED, REJECTED, DISPATCHED }`

### ClosingSheetLine
A row on the sheet. `id, closingSheetId, section, name, particulars, amount, paidInCash, advance,
paymentMode, notes, cleared, vendorId?, invoiceId?`
`section ∈ { PRODUCTION, PETTY_CASH }`
`paymentMode ∈ { NEFT, UPI, REIMBURSEMENT, COMPANY_CARD }`
`cleared ∈ { CLEARED, NOT_CLEARED }`

### Vendor  (see [[Features/09 Vendor Registry]])
`id, name, pan, gstin?, gstApplicable, category, bankDetails?, upiId?, contact?, poc?, createdAt`
Accumulates automatically from processed invoices.

### Invoice  (see [[Features/03 Validation Engine]])
`id, closingSheetId, vendorId?, category, projectName, shootDate?, amount, gstin?, gstApplicable,
gstAmount?, pan?, paymentMode, upiEligible, status, validationIssues (json), isManual, sourceEmailId?,
fileUrl?, createdAt`
`status ∈ { PENDING, VALIDATED, FLAGGED, AMBIGUOUS }`

### Reimbursement  (see [[Features/10 Reimbursements]])
`id, closingSheetId, producerId, projectName, date, description, amount, paymentMode (UPI|CASH),
receiptUrl?, status, decidedById?, createdAt`
`status ∈ { SUBMITTED, APPROVED, CHANGES_REQUESTED, REJECTED, PAID }`

### LedgerEntry  (see [[Features/11 Ledger]])
`id, vendorId, projectId, type, amount, date, notes?, createdAt`
`type ∈ { ADVANCE, PARTIAL, FINAL, REIMBURSEMENT }`
Drives per-vendor status Unpaid / Partially Paid / Fully Paid and net-payable calc.

### Dispatch  (see [[Features/07 Accounts Dispatch]])
`id, batchType, triggeredById, triggeredAt, includedSheetIds (json), notes?`
`batchType ∈ { MID_MONTH, MONTH_END }`

### AuditLog
`id, entityType, entityId, action, actorId, comment?, createdAt` — written on every state change.

### Notification
`id, type, recipientEmail, subject, body, relatedEntityType?, relatedEntityId?, status, sentAt?`

## Relationships (text ERD)
```
User 1─┬─* Project ──1─1 ClosingSheet ─1─* ClosingSheetLine
       │                     │  │
       │                     │  ├─* Invoice ──* ─1 Vendor ─1─* LedgerEntry
       │                     │  └─* Reimbursement
       └─* (producer/decider references throughout)
Dispatch *──* ClosingSheet (via includedSheetIds json)
AuditLog / Notification reference any entity by (type,id)
```
