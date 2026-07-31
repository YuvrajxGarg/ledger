# 03 · Validation Engine

Validates each invoice against the Revolio format (`reference/Revolio Invoicing Details.pdf`).

## Checks
- **GST** — GSTIN, HSN, tax breakup. Always requested; producer can mark **Not Applicable** (GST-exempt vendor).
  Calc rules TBD with accounts — for now validate *presence/structure*, not the math.
- **PAN** — mandatory.
- **UPI eligibility** — amount `< ₹5,000` → auto-tag UPI-eligible.
- **Payment mode** — NEFT / UPI / REIMBURSEMENT / COMPANY_CARD.
- **Cross-check** date, project name, vendor name against the closing sheet.
- Missing/mismatch → `FLAGGED`, notify producer (§7 #4).

## Explicitly NOT included
- **TDS** — house doesn't deduct. Removed.

## AI assist
muapi.ai extracts fields from PDF/image invoices and normalises vendor names before validation.

## Status
`PENDING → VALIDATED | FLAGGED | AMBIGUOUS`
