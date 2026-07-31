# Production House Accounting Automation — Consolidated Dev Brief (v2)

> Post-shoot expense management for a production house: invoice collection → validation → multi-tier
> approval → accounts dispatch → payment confirmation. Built around the **closing sheet** as the unit of work.
>
> **v2 changelog:** folded in the Revolio invoice format + District Manifesto closing sheet format;
> made **email the explicit notification layer** (trigger matrix added); added **Search & Filter** and
> **Vendor Registry** modules; **removed TDS** (GST retained); **removed the daily-wage signature** requirement.

---

## 1. Reference formats (source of truth)

### 1.1 Vendor invoice format — "Revolio Billing Details"
Every incoming vendor invoice is validated against this.

- **Billing entity:** Revolio Media Private Limited · GST `27AALCR9287L1ZC` · 701/702, Esperanza, Turner Road, Bandra West, Mumbai 400050.
- **Recipients:** To `riya@revolio.in`; CC `accounts@revolio.in`, `samir@revolio.in`, `rishti@revolio.in`.
- **Subject / filename convention:** `<Category>_Invoice_<Project Name>_<Month Year>`
  - Categories: Catering, Equipment, Acting, Casting, Art, Prop, DOP, Director, HMU, Dressman, Spot, Stylist.
  - Example: `Equipment Invoice_Superyou IPL Asset_March 2026`.
  - **This convention is the primary key for auto-matching** (see §3) — far more reliable than body-text scanning.
- **Invoice must include:** Project Name · Shoot Date · Revolio PoC name · vendor full name · contact number ·
  invoice/account-holder name match · supporting bills for conveyance · supporting bills for any amount above
  locked base cost · itemised equipment breakdown (if applicable) · **GST number (if applicable)** ·
  **PAN (mandatory)** · Bank details · UPI details.

### 1.2 Closing sheet format — "District Manifesto" template
| Column | Notes |
|---|---|
| Name | Vendor / person |
| Particulars | Role / nature of cost (DOP, spot, setting, equipment, props, food…) |
| Amount | Line amount |
| Paid in Cash | Marked when producer paid on set (incl. "company card") |
| Advance | Advance already paid → feeds the ledger (§10) |
| Invoice/Bills | Attached invoice reference |
| Notes | Free text |
| Cleared / Not Cleared | Per-line payment status |

Sections: **Production Costs** (subtotal) → **Petty Cash Expenses** (subtotal) → **Grand Total** →
**Less: GST** → **Total (excl. GST)**.

---

## 2. Closing Sheet Module
- Producer creates one closing sheet **per project**: shoot name, date, final budget.
- Follows the District Manifesto column/section structure above.
- Producer uploads / fills the sheet to initiate the workflow.
- The sheet is the container everything else attaches to: invoices, reimbursements, ledger, dispatch.

## 3. Automated Invoice Collection (Gmail)
- Connect producer's Gmail via **OAuth** (read-only scope) and scan for invoice attachments.
- **Match order:** (1) parse the `<Category>_Invoice_<Project>_<Month Year>` subject/filename convention →
  (2) fall back to client name + shoot name in subject/body.
- Auto-attach matched invoices to the correct closing sheet.
- **Ambiguity flag:** multiple / revised invoices with similar names or amounts → flag to producer, who
  manually picks the correct one. (Email notification — see §7.)

## 4. Invoice Validation Engine
Validates each invoice against §1.1. Checks:
- **GST compliance** — GSTIN, HSN codes, tax breakup. Always requested; producer marks **"Not Applicable"**
  if the vendor is GST-exempt.
- **PAN present** (mandatory).
- **UPI eligibility** — amounts **< ₹5,000** auto-tagged UPI-eligible.
- **Payment-mode tagging:**
  - `NEFT` — standard bank transfer
  - `UPI` — under ₹5K
  - `Reimbursement` — UPI paid personally by producer on set
  - `Company Card` — cash paid by producer on set *(matches "Paid in Cash / company card" on the sheet)*
- **Cross-check** date, project name, vendor name against the closing sheet.
- Missing/mismatched fields → flag + notify producer to follow up with vendor.
- **~~TDS~~ — removed.** The house does not deduct TDS.

## 5. Approval Workflow
- Producer submits closing sheet → **Senior Producer** gets an approval request.
- Senior Producer: **Approve / Reject / Request Changes** (with comments).
- Rejection → back to producer; **unlimited revision cycles**.
- Real-time status always visible to producer.
- **Full audit trail** — every upload, edit, approve, reject, pay is timestamped and logged with the actor.

## 6. Duplicate Invoice Handling
- Detect duplicate invoices **across shoots**; flag to Senior Producer.
- If a vendor worked multiple shoots in one month, Senior Producer can **merge their invoices into one PDF**
  before dispatch to accounts.

## 7. Notifications — Email Layer *(new: explicit trigger matrix)*
All producer/senior-producer/accounts notifications are sent via **email**. Every trigger below fires one.

| # | Trigger | Recipient(s) |
|---|---|---|
| 1 | Closing sheet submitted | Senior Producer (approval request) |
| 2 | Approved / Rejected / Changes requested | Producer |
| 3 | Invoice auto-matched & attached | Producer (optional daily digest) |
| 4 | Invoice validation failed / field mismatch | Producer |
| 5 | Ambiguous invoice (multiple/revised) | Producer |
| 6 | Duplicate invoice across shoots detected | Senior Producer |
| 7 | Reimbursement submitted | Senior Producer |
| 8 | Reimbursement approved / rejected / changes | Producer |
| 9 | Reimbursement marked **paid** | Producer |
| 10 | **25th-of-month** wrap-up reminder | Senior Producer + all producers |
| 11 | Mid-month early batch triggered | All producers (wrap up pending) |
| 12 | Dispatch sent to accounts | Accounts (the dispatch itself) + Senior Producer (confirmation) |
| 13 | Invoice/reimbursement marked **paid** | Producer |
| 14 | Closing sheet still pending at month-end | Senior Producer (escalation) |

> Implementation note: centralise as an event bus + templated emails so new triggers are config, not code.

## 8. Search & Filter *(new)*
Global search + filters across: closing sheets, invoices, vendors, reimbursements, payments, dispatch log.
Filter by project, vendor, date range, payment mode, status (unpaid/partial/paid, approved/pending), amount range,
GST applicable/exempt, dispatch batch.

## 9. Reimbursement Tab
- Separate tab for producers' out-of-pocket shoot expenses.
- Fields: producer name, shoot/project, date, vendor/expense description, amount, payment mode (UPI/cash), receipt upload.
- Linked to a closing sheet but lives in its own tab.
- Senior Producer reviews/approves **independently** of the closing sheet, unlimited revision cycles.
- Approved reimbursements auto-compiled into a **separate PDF summary** appended to every dispatch email.
- Producer notified when accounts marks it paid (trigger #9).

## 10. Accounts Dispatch
- **25th monthly** automated wrap-up reminder (trigger #10).
- **Mid-month manual trigger** — Senior Producer can push an early batch for urgent vendor releases; also fires the
  wrap-up reminder to producers (trigger #11).
- Senior Producer manually triggers the **final month-end dispatch** once everything is approved.
- Every dispatch includes: approved closing sheets + invoices + reimbursement summary PDF.
- Each dispatch clearly labelled **"Mid-Month Batch"** or **"Month-End Batch"**.
- Full **dispatch log** (who, when, what was included) for audit.
- Any closing sheet still pending at month-end → escalation to Senior Producer (trigger #14).

## 11. Payment Confirmation Loop
- Accounts logs in and marks invoices/reimbursements **Paid** (no edit access to anything else).
- Producer auto-notified (triggers #9, #13).

## 12. Manual Invoice Generator
- For daily-wage vendors who can't generate their own invoices.
- Fields: name, amount, date, nature of work, project name, payment mode.
- **~~Signature field~~ — removed** (not required).
- Generates a clean PDF, auto-attached to the closing sheet.

## 13. Advance & Partial Payment Ledger
- Ledger **per vendor per project**. Entry types: **Advance**, **Partial Payment**, **Final Payment**, **Reimbursement**.
- Per-vendor status on each closing sheet: **Unpaid / Partially Paid / Fully Paid** (maps to "Cleared / Not Cleared").
- Invoice total auto-calculates **balance due** after deducting advances/partials.
- Accounts sees the **net payable**, not just the invoice total.
- All advance/partial payments logged with dates for audit.

## 14. Vendor Registry *(new — populated from day one; automation is Phase 2)*
- A vendor record is created/updated automatically from every processed invoice: name, PAN, GST, category,
  bank/UPI details, contact, PoC, shoots worked, payment history.
- **Phase 1 (now):** the registry simply accumulates as a searchable database (feeds §8 and speeds re-matching).
- **Phase 2 (later):** automated invoice reminders to repeat vendors, prefilled vendor details, spend analytics
  per vendor, anomaly detection on rates.

---

## Roles & Permissions
| Role | Access |
|---|---|
| **Producer** | Create closing sheets, view own projects, respond to flags, generate manual invoices, submit reimbursements |
| **Senior Producer** | All producer permissions + approve/reject closing sheets & reimbursements, merge invoices, trigger mid-month & month-end dispatch, view all projects |
| **Accounts** | View approved closing sheets & reimbursements, mark payments paid — **no edit access** |
| **Admin** | Full access, user management, configure invoice format & validation rules |

---

## Open Items — before / during build
- [x] Closing sheet format — **received** (District Manifesto).
- [x] Vendor invoice format — **received** (Revolio Billing Details).
- [x] Daily-wage signature — **not needed** (removed).
- [x] TDS — **not deducted** (removed); GST retained.
- [ ] Confirm the fixed **project/shoot name** convention used in email subjects so auto-matching is deterministic.
- [ ] Confirm Gmail account(s) to connect (single shared inbox vs. per-producer).
- [ ] Confirm GST tax-breakup rules to validate against (rate slabs, reverse charge, etc.).
- [ ] Confirm dispatch recipient list on the accounts side (matches Revolio To/CC?).
