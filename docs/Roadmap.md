# Roadmap

Status legend: ✅ done · 🚧 in progress · ⬜ not started

## Phase 0 — Foundation ✅
- ✅ Stack decided, repo scaffolded ([[Decisions]])
- ✅ Planning vault + [[../CLAUDE|CLAUDE.md]]
- ✅ Prisma schema + seed (real District Manifesto data) ([[Data Model]])
- ✅ App shell: dark sidebar nav, dashboard w/ KPIs, mock role switcher, theme toggle, design system
- ✅ Closing Sheet module: list / create / detail with two-section lines + totals

## Phase 1 — Core workflow (no external integrations)
- ✅ Approval workflow (submit / approve / reject / request changes, revisions) [[Features/04 Approval Workflow]]
- ✅ Email notifications wired for submit + decision (dev console transport) [[Features/05 Notifications]]
- ✅ Audit trail written + surfaced on sheet detail
- ✅ Vendor registry read view (auto-accumulate write comes with invoices) [[Features/09 Vendor Registry]]
- ✅ Scanned invoices surfaced on closing-sheet detail page (linked `Invoice` rows shown under totals)
- 🚧 Add-line editing (done for draft/changes) — next: inline amount edit + invoice attach
- ✅ Manual invoice + upload attach [[Features/03 Validation Engine]] — "Add an invoice manually" on the Invoices
  screen (vendor auto-accumulate, same validation engine, optional attachment via `src/lib/uploads.ts`); `isManual` flagged.
- 🚧 Reimbursements tab + independent approval [[Features/10 Reimbursements]] — list/log/approve/mark-paid + **receipt
  upload** built (reusable `src/lib/uploads.ts`); PDF summary still pending
- ✅ Ledger (advance/partial/final, net payable) [[Features/11 Ledger]] — per-project/per-vendor rollup from
  invoices (owed) + logged payments; `markSheetPaid` auto-writes FINAL entries. Log/delete entries (Accounts/Admin).
- ✅ Search & filter [[Features/06 Search and Filter]] — reusable server `FilterBar` (URL params → Prisma `where`,
  `src/lib/filters.ts` for amount/date ranges) across **Closing Sheets, Invoices, Vendors, Reimbursements, Ledger**
  (text + status + amount/date ranges where meaningful). Global omni-search still "later".
- ✅ Accounts role: "to pay" queue + mark paid [[Features/08 Payment Loop]] — approved sheets (mark paid → clears
  all lines **and writes FINAL ledger entries for each vendor's outstanding balance**) + approved reimbursements,
  producer notified.
- ✅ Dispatch: mid-month / month-end batches + log [[Features/07 Accounts Dispatch]] — SrProd/Admin bundles APPROVED
  sheets → DISPATCHED (surface in Accounts queue), notifies accounts, full dispatch log. Auto-reminders/escalation deferred (cron).
- ✅ PDF generation (`src/lib/pdfgen.ts`, pdf-lib) — **generated invoice PDF** (`/api/invoices/[id]/pdf`, no signature)
  + **dispatch summary PDF** (`/api/dispatch/[id]/summary`, sheets + approved reimbursements). ₹→"Rs " for WinAnsi. Verified.

## Phase 2 — Integrations & intelligence
- 🚧 Google OAuth real login — built (custom `googleapis`, `/api/auth/google/*`); **pending user's Google
  console setup**: register redirect URI `http://localhost:3001/api/auth/google/callback`, add `gmail.readonly`
  scope + test users. [[Decisions]] ADR-005
- ✅ Gmail invoice scanning + auto-match on subject convention — `src/lib/gmail.ts` scanInbox (dedupe, vendor
  auto-accumulate, attachment save). Runs once a producer connects Gmail. [[Features/02 Invoice Collection]]
  - ✅ **Text-PDF extraction** — `src/lib/pdf.ts` (unpdf) reads the invoice inside the PDF, not just the email body.
  - ⛔ **Image / scanned-PDF extraction** — BLOCKED (not doable in dev). Scan now **detects + logs** attachments with
    no extractable text (`[gmail scan] … OCR/vision needed`). Unblock condition: deploy behind **`PUBLIC_BASE_URL`**
    (muapi vision needs a reachable `image_url`; localhost won't do) **and** muapi's Claude/vision endpoint back up.
    Then: build the public attachment URL → add a vision call to `src/lib/ai` → feed its text into `extractInvoiceFields`.
- ✅ LLM brain (muapi.ai) — extraction / fuzzy match / dedupe in `src/lib/ai/` (pluggable + regex fallback,
  verified live). muapi shape = async submit-then-poll ([[Decisions]] ADR-006).
- ✅ Validation engine — `src/lib/validation.ts` (PAN/GST presence, UPI eligibility, cross-checks → FLAGGED)
- ✅ Invoices screen — real list, scan, ambiguity resolution, discard (`src/app/invoices/`)
- ⬜ GST calculation rules (after accounts input)
- ✅ Real SMTP email — `notify.ts` sends via nodemailer when SMTP_* env is set, else console preview; Notification row
  records SENT|FAILED. Verified live through an Ethereal test inbox. (SES = just a different SMTP endpoint.)
- ✅ Scheduled reminders — `GET /api/cron/reminders` (external cron): 25th wrap-up reminder + month-end escalation for
  unresolved sheets (§7 #10/#14), `CRON_SECRET`-gated, `?force=` for testing. Verified live. Vendor invoice reminders still ⬜.

## Phase 3 — Prod hardening
- ⬜ Postgres migration, deploy, backups, error monitoring
