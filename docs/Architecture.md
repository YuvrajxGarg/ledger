# Architecture

## High level
A single **Next.js 15** app (App Router) serves both UI and backend. No separate API server — data mutations
go through **server actions**; reads happen in **React Server Components** querying Prisma directly.

```
Browser ──▶ Next.js (RSC + Server Actions) ──▶ Prisma ──▶ SQLite (dev) / Postgres (prod)
                     │
                     ├─▶ notify.ts ──▶ Nodemailer ──▶ email (dev: preview transport)
                     ├─▶ ai/ ────────▶ muapi.ai (Claude) — extraction / matching / dedupe
                     └─▶ gmail/ ─────▶ Gmail API (OAuth) — invoice scanning   [later phase]
```

## Layers
- **UI** — `src/app/**` route segments; shared components in `src/components`; primitives in `src/components/ui` (shadcn).
- **Domain/actions** — `src/app/**/actions.ts` server actions; validation via `zod`.
- **Data** — `src/lib/db.ts` exports a singleton Prisma client + re-exports enums/types.
- **Services** — `src/lib/notify.ts` (email), `src/lib/ai/*` (LLM brain), `src/lib/gmail/*` (collection), `src/lib/pdf/*` (manual invoice + dispatch bundles).
- **Auth** — `src/lib/auth.ts`. Mock now (cookie holds selected userId), Auth.js Google later behind same `getCurrentUser()`.

## Key design choices
- **Closing Sheet is the aggregate root.** Invoices, reimbursements, ledger entries, dispatch inclusion all
  reference it. See [[Data Model]].
- **Everything auditable.** State transitions call `logAudit(entityType, entityId, action, actorId, comment?)`.
- **Notifications are event-driven.** Each workflow transition calls the matching `notify*()` function. Swapping
  transport (console → SES/SMTP) is one file.
- **AI is optional & pluggable.** The app functions without the LLM; AI augments matching/validation. Provider =
  muapi.ai (Claude-compatible). Interface in `src/lib/ai/index.ts` so provider swaps are trivial.
- **Money as integer paise.** No floats. See [[Conventions]].

## Auth / OAuth path
Mock login seeds 4 users and stores `userId` in an httpOnly cookie; a dev role-switcher changes it.
Real path: Auth.js Google provider with Gmail read scope; `getCurrentUser()` signature stays identical so no
call sites change. Requires user-supplied Google Cloud OAuth client id/secret.

## Environments
- **dev:** SQLite file `web/prisma/dev.db`, email preview to console, mock auth.
- **prod (later):** Postgres, real SMTP/SES, Google OAuth, muapi key.
