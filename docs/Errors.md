# Errors

Bugs/gotchas hit and how they were fixed — so we never debug the same thing twice. Newest first, date each.

## Template
```
### YYYY-MM-DD — <short title>
**Symptom:** what broke / error text
**Cause:** root cause
**Fix:** what resolved it
**Prevention:** guard/convention added
```

## Log

### 2026-07-31 — muapi.ai is not OpenAI-compatible (Claude proxy also 500ing)
**Symptom:** AI extraction always returned `source: "regex"`; `POST /v1/chat/completions` → 404. After fixing the
shape, `claude-*` jobs came back `status: failed` — `500 Internal Server Error for url https://api.kie.ai/claude/v1/messages`.
**Cause:** (1) muapi uses an async **submit-then-poll** API (`POST /api/v1/{model}` → `request_id`, poll
`/api/v1/predictions/{id}/result`), not OpenAI chat-completions. (2) muapi proxies Claude via kie.ai, which was
returning 500 for every Claude model that day (Gemini models worked).
**Fix:** Rewrote the muapi adapter in `src/lib/ai/client.ts` to submit-then-poll and read `outputs[0]`. Kept
`MUAPI_MODEL` configurable; regex fallback covers provider outages.
**Prevention:** Never assume an aggregator's API flavor — check its `openapi.json`. See [[Decisions|ADR-006]].

### 2026-07-31 — Gmail scan pulled unrelated invoices from a real inbox
**Symptom:** First real scan created ₹0 AMBIGUOUS invoices + junk vendor rows (Mayank, Saksham, an Adobe receipt)
and even read the user's own Sent mail.
**Cause:** Broad `subject:invoice` query with no inbox restriction, and every scanned mail was turned into an
invoice + vendor regardless of whether it was a Revolio shoot invoice.
**Fix:** `in:inbox` in the query; **gate** on shoot-match-or-convention (log + ignore otherwise); upsert
vendor/save attachment only for kept invoices; `GMAIL_SCAN_STRICT` toggle. Cleaned existing noise rows via script.
**Prevention:** [[Decisions|ADR-007]]. The `<Category>_Invoice_<Project>_<Month Year>` convention is the noise filter.

### 2026-07-31 — SQLite "vendors created but no invoice" (partial write under lock)
**Symptom:** After a scan, some vendors existed with no matching invoice.
**Cause:** The scan writes many rows while the Next dev server holds the same SQLite file — a transient
"database is locked" aborted a per-message write *after* the vendor upsert but *before* the invoice create.
**Fix:** Re-scan completed the rows (dedupe on `sourceEmailId` made it safe). For bulk DB scripts, stop the dev
server first. Will disappear on Postgres (Phase 3).
**Prevention:** Stop the dev server before bulk writes; keep vendor upsert idempotent (it is).

### 2026-07-31 — Prisma client EPERM on Windows during migrate/generate
**Symptom:** `prisma generate` → `EPERM: operation not permitted, rename query_engine-windows.dll.node`.
**Cause:** A running Next dev server (from another session) holds the query-engine DLL open, blocking the rename.
**Fix:** Stop the dev server, then `npx prisma generate`. Migrations still *apply* (DB syncs first); only client
generation is blocked. `migrate dev --skip-generate` lets the migration land regardless.
**Prevention:** Stop dev servers before migrating on Windows; regenerate the client afterward.

### 2026-07-31 — Prisma 7 rejects `url` in schema
**Symptom:** `prisma migrate dev` → `P1012 The datasource property 'url' is no longer supported in schema files`.
**Cause:** `create-next-app`/npm pulled **Prisma 7.9.1**, which requires `prisma.config.ts` + driver adapters and
forbids `url = env(...)` in `schema.prisma`.
**Fix:** Pinned **Prisma 6** (`npm i -D prisma@6 && npm i @prisma/client@6`). The classic url-in-schema + SQLite
flow works out of the box.
**Prevention:** Stay on Prisma 6 for now (see [[Decisions|ADR-002]]). Revisit driver adapters only if we go Postgres/edge.
