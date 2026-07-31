# Decisions (ADR log)

Newest first. Each: context → decision → consequence.

## ADR-007 — Gmail scan is strict by default (convention/match gate), toggleable
**Context:** Scanning a real inbox pulled in unrelated "invoice"/"receipt" mail (e.g. "Invoice for the month of
July"), creating ₹0 AMBIGUOUS invoices + junk vendor rows. It also read the user's own Sent mail.
**Decision:** (1) Query `in:inbox` only. (2) **Gate:** keep an email only if it matches a shoot *or* follows the
Revolio convention `<Category>_Invoice_<Project>_<Month Year>`; otherwise **log + ignore**. (3) Vendor upsert +
attachment save happen only for kept invoices. The gate is behind **`GMAIL_SCAN_STRICT`** (default `true`) —
set `false` to roll back to creating an AMBIGUOUS invoice per candidate.
**Consequence:** Clean invoices/vendor registry by default; prod can loosen via env if producers don't always
follow the convention. Ignored subjects are logged for visibility. See [[Learnings]], [[Errors]].

## ADR-006 — muapi.ai is async submit-then-poll (not OpenAI-compatible)
**Context:** Built the AI client assuming muapi exposed an OpenAI `/v1/chat/completions` endpoint — it 404s.
muapi's real shape (from its OpenAPI spec): `POST /api/v1/{model}` with `{prompt, system_prompt}` + `x-api-key`
returns a `request_id`; poll `GET /api/v1/predictions/{id}/result` for `{status, outputs:[text]}`.
**Decision:** Implement the submit-then-poll adapter; model id is `MUAPI_MODEL` (e.g. `claude-sonnet-4-5`).
**Consequence:** Per-call latency ~10s (polling). muapi proxies Claude via kie.ai, which was 500ing on 2026-07-31
for all `claude-*` models (Gemini worked) — the regex fallback covers the gap. See [[Errors]], [[Learnings]].

## ADR-005 — Custom Google OAuth (not next-auth) behind getCurrentUser()
**Context:** Real Google login + Gmail token storage. next-auth v5 on Next 16.2 is unproven, and ADR-003 already
designed `getCurrentUser()` to swap internals. **Decision:** Lightweight OAuth2 via `googleapis` — route handlers
under `/api/auth/google/*`, tokens on the `User` row, reusing the existing `revolio_uid` cookie session.
**Consequence:** No call-site changes; same `googleapis` client powers Gmail scanning. Dev pinned to port 3001 so
the OAuth redirect URI is stable (3000 is taken locally by Adobe). Supersedes the "Auth.js" note in ADR-003.

## ADR-004 — LLM provider: muapi.ai (Claude)
**Context:** Need intelligent invoice field extraction, fuzzy project/vendor matching, duplicate detection.
User has muapi.ai (Claude-compatible API). **Decision:** Use muapi.ai behind a thin interface in `src/lib/ai/`.
**Consequence:** App works without it; AI is additive. Provider swap = one file. Key: `MUAPI_API_KEY`.

## ADR-003 — Mock auth first, Auth.js Google later
**Context:** Real Gmail/Google login needs Google Cloud OAuth creds the user hasn't provided; can't block the
build on it. **Decision:** Ship a mock role-based login (seeded users + cookie + dev role switcher) behind
`getCurrentUser()`. **Consequence:** Full workflow is testable now; real OAuth drops in without touching call sites.

## ADR-002 — SQLite for dev, Postgres for prod
**Context:** Want zero-setup local dev. **Decision:** Prisma + SQLite file in dev; Postgres in prod.
**Consequence:** Avoid SQLite-only features; keep schema portable (no enums-as-native — Prisma maps them).

## ADR-001 — Next.js full-stack (RSC + server actions), no separate API
**Context:** One small internal app, one team, fast iteration. **Decision:** Next.js App Router; mutations via
server actions, reads via RSC + Prisma. **Consequence:** Less boilerplate, one deploy. If we later need a public
API or mobile client, add route handlers then.

## ADR-000 — Closing Sheet is the aggregate root
**Context:** Everything in the domain hangs off a shoot's closing sheet. **Decision:** Model ClosingSheet as the
root; invoices/reimbursements/ledger/dispatch reference it. **Consequence:** Clean permissions & audit scoping;
approval/dispatch operate on the sheet.
