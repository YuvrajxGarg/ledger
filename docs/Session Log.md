# Session Log / Handoff

Running log of what happened each session, so a new chat can resume without re-deriving anything.
Newest first. See [[Roadmap]] for the live checklist and [[../CLAUDE|CLAUDE.md]] for the fast-start.

## 2026-07-31 — Marathon: finished all remaining unblocked backlog (GST deferred by user)

User asked to finish every remaining unblocked item one by one; GST math is explicitly deferred to their internal
team (post-testing). Worked through a 7-item task list. All typecheck-clean and verified live; every test mutation
reverted. New deps: **nodemailer**, **pdf-lib** (`npm install` OK).

1. **Per-line cleared state** — sheet detail shows a green "Paid" badge per line (`ClosingSheetLine.cleared`) and a
   header "Paid" badge when all lines cleared. Verified by toggling 3/7 lines.
2. **Search/filter extended** — generalized `FilterBar` (optional status / amount-range / date-range; `src/lib/filters.ts`
   builds the Prisma range clauses) now on **Vendors** (search), **Reimbursements** (search+status+amount+date),
   **Ledger** (post-rollup search), plus amount range added to **Invoices**. Verified across vendors/ledger/invoices.
3. **Real SMTP** — `notify.ts` sends via nodemailer when SMTP_* env set, else console; Notification row records
   SENT|FAILED. `.env` documents SMTP_URL / discrete vars. Verified live through an **Ethereal** test inbox (SENT).
4. **Scheduled reminders** — `GET /api/cron/reminders` (nodejs runtime, `CRON_SECRET`-gated, `?force=`): 25th wrap-up
   reminder + last-day month-end escalation; `notifyWrapUpReminder` / `notifyMonthEndEscalation`. Verified both via
   `?force=` (each found the 1 pending Superyou draft; escalation email fired). External cron must hit the route daily.
5. **PDF generation** — `src/lib/pdfgen.ts` (pdf-lib; ₹→"Rs " for WinAnsi). `GET /api/invoices/[id]/pdf` (generated
   invoice, no signature) + `GET /api/dispatch/[id]/summary` (sheets + approved reimbursements, subtotals + grand
   total). Download links on invoice cards + dispatch-log cards. Both PDFs inspected visually — clean.
6. **OCR / image-scanned PDF** — assessed **BLOCKED** in dev: muapi vision needs a public `image_url` (localhost
   unreachable) and muapi's Claude proxy is down. Added a scan-time **detection log** for attachments with no
   extractable text, `PUBLIC_BASE_URL` env doc, and the exact unblock steps in the Roadmap. No unverifiable vision code shipped.
7. **Committed + pushed** — production build green (19 routes). Gitignored `/prisma/*.db` + `/public/uploads/`,
   verified no secrets/`.env`/db in the tree, committed on branch `feat/accounting-buildout`, merged the repo's
   existing `LICENSE`, and pushed to **github.com/YuvrajxGarg/ledger** `main` (public repo — confirmed 78 files, no
   `.env`/`dev.db`/uploads on remote). `.env` stays local/gitignored — **rotate the pasted Google secret + muapi key**.

## 2026-07-31 — Search & filter (Closing Sheets + Invoices)

### Shipped (typecheck clean, verified live)
- **Reusable `FilterBar`** `web/src/components/filter-bar.tsx` — server component, plain GET `<form>` (no client JS):
  text `q` + `status` select → navigates to `?q=…&status=…`; shows a "Clear" link when active. Page reads
  `searchParams` and builds a Prisma `where`. (SQLite `LIKE` is case-insensitive for ASCII, so `contains` needs no
  `mode` — which SQLite doesn't support anyway.)
  - **Closing Sheets** `web/src/app/closing-sheets/page.tsx` — now takes `searchParams`; `q` matches project **or**
    producer name, `status` filters sheet status (producer-scope restriction still ANDed in). Filtered empty-state.
  - **Invoices** `web/src/app/invoices/page.tsx` — `q` matches vendor / subject / projectName, `status` filters; the
    existing status-grouped display just narrows. Filtered empty-state; filter bar only shows when there's data or an active filter.
- **Verified live:** `?q=district` → only District Manifesto; `?q=radhika` → only that invoice; `?q=zzznomatch` and
  `?status=FLAGGED` → "No matching …" empty states with Clear. Case-insensitive (typed lowercase, matched title-case).
- Read-only feature — no DB writes, nothing to clean up.

### Follow-ups
- Extend to vendors / reimbursements / ledger + add date-range and amount-range filters (Feature 06 lists these).
- A global omni-search (optionally LLM-assisted) is still a "later" per the feature doc.

## 2026-07-31 — Manual invoice entry + attachment

### Shipped (typecheck clean, verified live)
- **Add an invoice manually** — collapsible form on the Invoices screen for invoices Gmail didn't catch:
  - `web/src/app/invoices/actions.ts` `createManualInvoiceAction` — vendor auto-accumulate (reuses the **now-exported**
    `upsertVendor` from `gmail.ts`, no logic duplication), optional attachment via `saveUpload(…, "invoices")`, runs the
    **same `validateInvoice`** engine as scanned invoices → VALIDATED/FLAGGED, `isManual: true`, `sourceSubject:
    "Manual entry"`, `matchConfidence: 100`, PAN/GSTIN upper-cased, payment-mode auto-tag (< ₹5k → UPI).
  - `web/src/app/invoices/page.tsx` — `<details>` disclosure form (shoot, vendor, category w/ `INVOICE_CATEGORIES`
    datalist, amount, PAN, GSTIN, payment-mode, shoot date, GST-applicable checkbox, file input). Added a local `Field`.
  - `web/src/app/closing-sheets/[id]/page.tsx` — renamed the sheet-detail "Scanned invoices" section → **"Invoices"**
    (manual ones surface there too, since it queries all invoices on the sheet).
- **Verified live:** added a manual Pratik Garad · Equipment · ₹4,500 invoice → auto-tagged UPI, VALIDATED, matched to
  District Manifesto, showed on both the Invoices screen (Validated (2)) and the sheet detail (Invoices (2)). Validation
  engine spot-checked via `tsx`: clean input → VALIDATED; missing PAN/GSTIN + project mismatch → FLAGGED with 3 issues.
  Test invoice removed afterward.

### Gotcha for next time
- The manual form is a `<details>` disclosure — a mis-aimed click toggles it shut instead of submitting (no POST fires).
  When automating, `scroll_to` the submit button and click it directly.

## 2026-07-31 — File uploads (reusable) + reimbursement receipts

### Shipped (typecheck clean, verified)
- **Reusable upload helper** `web/src/lib/uploads.ts` — `saveUpload(formDataEntry, subdir)`: duck-types the web `File`
  from a server action's FormData, validates type (`pdf|png|jpe?g|webp`) + size (≤10 MB), writes to
  `public/uploads/<subdir>/` with a collision-proof sanitized name, returns the public URL (or `null`, best-effort —
  never throws). Mirrors the Gmail-attachment convention. **Shared infra** for reimbursement receipts + (next) manual
  invoice attachments.
- **Reimbursement receipts** — `createReimbursement` now saves `formData.get("receipt")` via `saveUpload(…, "receipts")`
  into the existing `receiptUrl` column. Form got a "Receipt (optional)" file input (`accept` filtered); receipt link
  shown on each reimbursement card **and** on the Accounts payout rows.
- `web/.gitignore` — added `/public/uploads/` (runtime data: uploads + saved Gmail attachments, not source).

### Verified
- Browser: restructured form still submits (logged a no-receipt reimbursement fine).
- File path can't be driven through the preview pane (browsers block programmatic file-input set; pane has no
  file-picker tool), so tested `saveUpload` directly via `npx tsx` with a real `File`: valid PDF saved (filename
  sanitized), oversize/bad-type/empty all → `null`, readback confirmed bytes on disk. Then `fetch()` of the URL in the
  page returned **200 · application/pdf · 34 bytes** — Next serves it. Test rows + uploaded file cleaned up.

### Follow-ups
- Reimbursement **edit/resubmit** doesn't re-accept a receipt (create-only). No error surfaced to the user when a file
  is rejected (best-effort drop) — would need `useFormState` plumbing this codebase doesn't use yet.

## 2026-07-31 — Dispatch (batches to accounts + log)

### Shipped (typecheck clean, verified live)
- **Dispatch module** — SrProd/Admin bundles APPROVED closing sheets into a labelled batch:
  - `web/src/app/dispatch/page.tsx` — "New dispatch" card (checkbox list of APPROVED sheets, default all checked, with
    producer/date/lines/total), batch selector (Mid-Month / Month-End), optional note; plus a **Dispatch log**
    (batch badge, count, who/when, linked sheet names, note). Non-dispatchers see a read-only info note.
  - `web/src/app/dispatch/actions.ts` — `createDispatch`: re-checks each selected sheet is still APPROVED, creates a
    `Dispatch` row (`includedSheetIds` = JSON array), flips those sheets → **DISPATCHED**, audits each sheet + the
    Dispatch, fires `notifyDispatch`, revalidates `/dispatch` + `/closing-sheets` + `/accounts`.
  - `web/src/lib/enums.ts` — `BATCH_TYPE_LABEL` (Mid-Month Batch / Month-End Batch).
- **Chain now connects:** approve → **dispatch** → sheet DISPATCHED (still payable — Accounts query already includes
  DISPATCHED) → mark paid → ledger FINAL entry.
- **Verified live end-to-end:** dispatched the District Manifesto sheet as a Month-End Batch → log entry created,
  approved list emptied, Accounts queue showed it with the **Dispatched** badge (still Mark-paid-able), both dispatch
  notifications fired. Seed reverted (sheet back to APPROVED; Dispatch/audit/notification test rows removed).

### Deferred (dispatch follow-ups, cron-shaped)
- 25th-of-month auto-reminder to wrap up submissions (§7 #10) and month-end escalation for still-pending sheets (§7 #14)
  — both need a scheduler; not built. Reimbursement-summary PDF bundled into a dispatch also pending (needs PDF infra).

## 2026-07-31 — Ledger (net payable) + payment-loop wiring

### Shipped (typecheck clean, verified live)
- **Ledger module** — per-**project**/per-**vendor** rollup: owed comes from matched `Invoice` rows, paid from
  `LedgerEntry` rows; balance + status (Unpaid / Partially paid / Fully paid) derived.
  - `web/src/lib/ledger.ts` — `ledgerStatus(invoiced, paid)` + `LEDGER_STATUS_LABEL`.
  - `web/src/app/ledger/page.tsx` — net-outstanding summary, "Log a payment" form (project, vendor, type, amount,
    date, note), per-project tables with each vendor's advance/partial/final entries as chips (delete ×). Gated:
    log/delete for Accounts/Admin (`can(markPaid)`); nav item visible to Senior Producer/Accounts/Admin.
  - `web/src/app/ledger/actions.ts` — `logLedgerEntry`, `deleteLedgerEntry` (audit `entityType: "LedgerEntry"`).
  - `web/src/lib/enums.ts` — `LEDGER_TYPE_LABEL`. `web/src/components/sidebar-nav.tsx` — **Ledger** nav item (Scale icon).
- **Payment loop → ledger wiring** — `web/src/app/accounts/actions.ts` `markSheetPaid` now, after clearing lines,
  computes each vendor's outstanding balance on the project (invoiced − already-logged) and writes a **FINAL**
  `LedgerEntry` per vendor with a positive balance (`notes: "Auto: sheet marked paid"`), then revalidates `/ledger`.
- **Verified live end-to-end:** logged a ₹1,000 Advance for Radhika Caterers (balance ₹3,200 → ₹2,200, Partially paid)
  → marked the sheet paid in Accounts → ledger auto-added a **FINAL ₹2,200** entry → vendor Fully paid, net ₹0.
  All seed mutations reverted afterward (lines NOT_CLEARED, ledger/audit/notification test rows removed).

### Notes / follow-ups
- "Owed" is sourced from **invoices** (the automated pipeline's output), not manual sheet lines — sheet lines mostly
  lack `vendorId` in seed data, so invoice-based rollup is the reliable signal. Manual line→vendor linking is a later refinement.
- Sheet detail page still doesn't surface per-line `cleared` state — small follow-up.

## 2026-07-31 — Accounts "to pay" queue + mark paid

### Shipped (typecheck clean, verified live)
- **Accounts screen** — replaced the ComingSoon placeholder with a real payment queue:
  - `web/src/app/accounts/page.tsx` — summary tiles (outstanding ₹, sheets to pay, reimbursements to pay), a
    **Closing sheets** section (status APPROVED/DISPATCHED) and a **Reimbursements** section (status APPROVED).
    Sheet paid-state is **derived from the per-line `cleared` flag** (fully paid = all lines CLEARED; partial shows
    `n/total`), so **no schema/status migration** was needed. Mark-paid controls gated to Accounts/Admin; others see
    a read-only note.
  - `web/src/app/accounts/actions.ts` — `markSheetPaid`: sets every line `cleared = CLEARED`, writes an AuditLog
    (`ClosingSheet`/`PAID`) and fires `notifySheetPaid`. Reuses `markReimbursementPaid` from the reimbursements module
    for the reimbursement rows.
  - `web/src/lib/notify.ts` — added `notifySheetPaid` (§7 payment-confirmation trigger).
  - **Verified live end-to-end:** marked the District Manifesto sheet paid → green Paid badge, button hides,
    Outstanding dropped ₹98,700 → ₹0, both producer notifications fired. Seed data reverted afterward
    (lines back to NOT_CLEARED, test audit/notification rows removed).

### Deferred (payment-loop follow-ups)
- **Ledger writes** — marking paid should create FINAL/PARTIAL `LedgerEntry` rows and drive per-vendor net-payable;
  deferred to the Ledger module (needs vendor-linked lines). Per-line "clear" granularity (currently whole-sheet).
- Sheet detail page doesn't yet show the `cleared` state per line — surface it there next to the payment badge.

## 2026-07-31 — Scanned invoices on sheet detail + Reimbursements module

### Shipped (typecheck clean, verified live)
- **Scanned invoices on the closing-sheet detail page** — `web/src/app/closing-sheets/[id]/page.tsx` now
  queries `Invoice` rows where `closingSheetId = sheet.id` and renders a **Scanned invoices** section between the
  totals card and the audit trail (vendor, status badge, category, UPI tag, amount, PAN/GSTIN, attachment link,
  validation issues). Verified on the District Manifesto sheet — the live-matched Radhika Caterers invoice shows.
- **Reimbursements module** (Phase 1) — replaced the ComingSoon placeholder with a real screen + workflow:
  - `web/src/app/reimbursements/actions.ts` — `createReimbursement`, `decideReimbursement` (approve/changes/reject),
    `resubmitReimbursement` (owner, after changes/reject), `markReimbursementPaid` (accounts), `deleteReimbursement`.
    Every action writes an AuditLog (`entityType: "Reimbursement"`) + fires a notify helper. Reuses the closing-sheet
    server-action + audit + notify pattern. Amounts via `toPaise`; producers see only their own, others see all.
  - `web/src/app/reimbursements/page.tsx` — "Log an expense" form (shoot select, date, description, amount, UPI/Cash),
    grouped list (Awaiting / Changes / Approved-ready-to-pay / Paid / Rejected), role-gated action controls per row.
  - `web/src/lib/notify.ts` — `notifyReimbursementSubmitted` / `Decision` / `Paid` (§7 matrix, dev console transport).
  - `web/src/lib/enums.ts` — `REIMBURSEMENT_STATUS_LABEL`, `ReimbursementPaymentMode` (UPI|CASH) + label map.
  - `web/src/components/status-badge.tsx` — `ReimbursementStatusBadge` now uses the label map (was `toLowerCase()`).
  - **Verified live end-to-end:** logged ₹2,400 fuel expense → approved → marked paid; status moved
    Submitted→Approved→Paid, "Decided by" populated, Discard hidden on Paid, and all 3 notification emails fired
    (console). Test rows cleaned from the DB afterward.
- Added `web/.claude/launch.json` (session had none) — dev server config, runs `next dev` on port 3001.

### Deferred (reimbursements follow-ups)
- **Receipt upload** (schema `receiptUrl` unused) + **PDF summary** appended to dispatch — needs file-upload infra
  (same as invoice attachments). Reimbursement editing (currently resubmit-only after changes).

## 2026-07-31 — Phase 2 core: Google OAuth + LLM brain + Gmail scan + validation

### ✅ VERIFIED LIVE END-TO-END (by Yuvraj, real Gmail)
Signed in with Google → scanned Gmail → a PDF invoice was read from inside the attachment, extracted by the
LLM (vendor "Radhika Caterers", Catering, ₹3,200, PAN, GSTIN), auto-tagged **UPI**, matched to **District
Culture | Manifesto**, and marked **Validated**. Vendor auto-added to the registry. The full pipeline works.

### Shipped (build green, TS clean)
- **AI brain** `web/src/lib/ai/` — pluggable client (`AI_PROVIDER=muapi|anthropic|mock`) with a deterministic
  regex/similarity **fallback**. `extractInvoiceFields`, `matchProject` (convention → similarity → LLM), `detectDuplicate`.
  muapi is **async submit-then-poll** ([[Decisions|ADR-006]]).
- **Google OAuth** (custom, `googleapis`) — `web/src/lib/google.ts` + `/api/auth/google`, `/callback`, `/logout`.
  Upserts the user, stores tokens on `User`, reuses the `revolio_uid` cookie ([[Decisions|ADR-005]]). `/login` page +
  sidebar "Gmail connected / Sign in" affordance.
- **Gmail scan** `web/src/lib/gmail.ts` — `scanInbox` pulls **inbox-only** invoice mail, extracts, matches, upserts
  vendor (registry auto-accumulate), validates, dedupes on message id, saves attachments to `public/uploads/invoices/`.
  - **Text-PDF extraction** `web/src/lib/pdf.ts` (unpdf) — reads the invoice inside the PDF, not just the email body.
  - **Noise gate** ([[Decisions|ADR-007]]) — keeps only shoot-matched OR convention-following mail; everything else
    is **logged + ignored**. Toggle with `GMAIL_SCAN_STRICT` (default `true`). Vendors/attachments saved only for kept mail.
- **Validation engine** `web/src/lib/validation.ts` — PAN (mandatory), GSTIN presence when applicable, UPI eligibility,
  payment-mode + project/date cross-checks → `VALIDATED | FLAGGED`. GST math still deferred (accounts input).
- **Invoices screen** `web/src/app/invoices/` — grouped by status, scan button, ambiguity resolution (assign to
  sheet), discard, attachment links, scan summary banner (incl. "N ignored").
- **Schema:** `User` Google-token fields + `gmailLastScanAt`; `Invoice` `sourceSubject`/`matchConfidence` and
  **optional** `closingSheetId` (unmatched inbox). Two migrations applied.

### Config / environment (carry forward)
- Dev pinned to **port 3001** (3000 held by Adobe); Google redirect URI registered by user, scope + test users added.
- `MUAPI_MODEL="gemini-3-flash"` for now — muapi's **Claude proxy (kie.ai) was 500ing** on 2026-07-31. Revert to
  `claude-sonnet-4-5` once it recovers; the pluggable client makes it a one-line switch.
- `GMAIL_SCAN_STRICT="true"`. Secrets are in gitignored `web/.env` — **rotate the pasted Google secret + muapi key when convenient**.

### Deferred (Phase 2 remainder / next up)
- Surface scanned invoices on the **closing-sheet detail** page (linked in DB, not yet shown on the sheet).
- **Image / scanned-PDF** extraction (OCR/vision — needs a public URL for muapi `image_url`).
- GST calc math (blocked on accounts), real SMTP/SES (`notify.deliver()` swap point), vendor reminders, manual invoice PDF.
- Phase 1 gaps still open: Reimbursements, Accounts mark-paid, Ledger, Dispatch.

## 2026-07-31 — Foundation + core approval workflow

### Shipped (all verified running on the dev server)
- **Planning vault** ([[00 Home]], [[Architecture]], [[Data Model]], [[Structure]], [[Roadmap]], [[Decisions]],
  [[Conventions]], [[Learnings]], [[Errors]]) + 12 feature notes + root [[../CLAUDE|CLAUDE.md]] and
  [[../PRODUCT_BRIEF|PRODUCT_BRIEF.md]]. Reference PDFs in `reference/`.
- **App** in `web/` (Next.js 16.2, TS, Tailwind v4, Prisma 6 + SQLite):
  - Prisma schema for all entities + seed with the real **District Manifesto** data (`web/prisma/seed.ts`).
  - App shell: dark sidebar, KPI dashboard, mock role switcher, theme toggle, token-based design system.
  - Closing Sheets: list / create / detail (two sections, payment-mode badges, auto UPI-tag < ₹5k, totals).
  - Approval workflow: submit → approve / request changes / reject (+comment), revisions, **audit trail** in UI.
  - Email notifications wired for submit + decision (dev console transport, recipients `rishti@` + `yuvraj@`).
  - Vendors registry read view. Placeholder pages for reimbursements / dispatch / accounts / invoices / settings.
- **Verified end-to-end in the browser:** approved the District Manifesto sheet as Admin → status flipped to
  Approved, audit logged, both notification emails fired to the configured recipients.

### Key facts to carry forward
- `npm run build` was green (TS clean, 12 routes). Dev server auto-picks a free port (3000 is taken locally by
  Adobe CEPHtmlEngine → `autoPort: true` in `.claude/launch.json`).
- Money = integer **paise** everywhere; format with `formatINR()`.
- Mock auth: active user in a cookie; switch via the sidebar dropdown. Real Google OAuth slots behind
  `getCurrentUser()` unchanged.
- `web/` has its own git repo (from create-next-app); **nothing committed yet**. Root `prodapp/` is not a git repo.

### Open dependencies from Yuvraj (block Phase 2)
- Google Cloud OAuth credentials → real login + Gmail scanning.
- `MUAPI_API_KEY` → the Claude brain (extraction / matching / dedupe).
- Accounts input on GST calc rules + dispatch recipient list.

### Recommended next steps (in order)
1. **Reimbursements** module ([[Features/10 Reimbursements]]) — own tab, independent approval, PDF summary stub.
2. **Accounts** role: view approved sheets/reimbursements + **mark paid** loop ([[Features/08 Payment Loop]]).
3. **Ledger** (advance/partial/final → net payable) ([[Features/11 Ledger]]).
4. Then external: **Dispatch** batches, then Gmail + LLM once creds arrive.
   Start by reading [[../CLAUDE|CLAUDE.md]] → then this file → then `web/src/app/closing-sheets/*` as the pattern
   to copy (server actions + RSC + audit + notify).
