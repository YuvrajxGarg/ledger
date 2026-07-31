# Learnings

Non-obvious things discovered while building. Append freely; date each entry.

## 2026-07-31
- **Invoice matching key:** the Revolio invoice format mandates a subject/filename convention
  `<Category>_Invoice_<Project Name>_<Month Year>`. Matching on this parsed key is far more reliable than
  scanning email body text. Store a `canonicalKey` slug on Project and match against the parsed subject.
- **Closing sheet reality:** the real sheet ("District Manifesto") uses two sections — **Production Costs** and
  **Petty Cash Expenses** — each with a subtotal, then Grand Total → Less GST → Total (excl. GST). The columns are
  Name / Particulars / Amount / Paid in Cash / Advance / Invoice-Bills / Notes / Cleared. The data model mirrors this.
- **"Company card" overlap:** the sheet records "company card" as a value under *Paid in Cash*, while the brief
  lists `COMPANY_CARD` as its own payment mode ("cash paid by producer"). Kept both but flagged to reconcile the
  payment-mode dropdown 1:1 with the sheet. (Open item.)
- **No TDS** at this house — dropped from the validation engine entirely. GST stays (calc rules pending accounts).
- **muapi.ai LLM API** (Phase 2): async per-model endpoints `POST /api/v1/{model}` `{prompt, system_prompt, image_url?}`
  with `x-api-key` → `{request_id}`, then poll `GET /api/v1/predictions/{id}/result` → `{status, outputs:[text]}`.
  `image_url` is a URL (not base64). Model ids include `claude-sonnet-4-5`, `gemini-3-flash`, etc. ~10s latency.
- **OAuth needs a stable dev port:** Google requires an exact pre-registered redirect URI, so autoPort can't be
  used for the OAuth flow. Pinned dev to **3001** (3000 is held by Adobe CEPHtmlEngine); register
  `http://localhost:3001/api/auth/google/callback`.
- **Unmatched invoices need a home:** made `Invoice.closingSheetId` optional so scanned-but-unmatched/ambiguous
  invoices persist in an "inbox" for producer resolution, rather than being dropped.
- **Gmail scan is AI-gated but not AI-dependent:** extraction/matching each have a deterministic regex/similarity
  fallback, so scanning still produces useful (if coarser) results when the LLM is unavailable.
- **Real inboxes are noisy:** a broad `subject:invoice` scan pulled in SaaS receipts, personal mail, and the
  user's own Sent items. Fixes (2026-07-31): scan `in:inbox` only; **gate** on shoot-match-or-convention
  (`GMAIL_SCAN_STRICT`, logged + toggleable); upsert vendors/save attachments only for kept invoices. See ADR-007.
  Reinforces why the `<Category>_Invoice_<Project>_<Month Year>` convention matters — it's the noise filter.
