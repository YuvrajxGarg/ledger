# CLAUDE.md — Revolio Accounting Automation

> Read this first, every session. It's the fast-start map. Deep context lives in the Obsidian vault at `docs/`.

## What this is
Internal web app for **Revolio Media Pvt Ltd** to automate post-shoot expense management:
invoice collection (Gmail) → validation → multi-tier approval → accounts dispatch → payment confirmation.
The **Closing Sheet** (one per project/shoot) is the unit everything attaches to.

Full spec: [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md). Vault home: [docs/00 Home.md](docs/00%20Home.md).

## Stack (decided — don't re-litigate)
- **Next.js 16.2** (App Router, RSC + server actions) + **TypeScript**, in `web/`.
  ⚠️ Next 16: `params`/`searchParams`/`cookies()`/`headers()` are **async — await them**. Turbopack is default.
- **Tailwind v4** + **hand-rolled primitives** in `web/src/components/ui.tsx` (shadcn-style, no shadcn CLI).
  Token-based theming (light/dark) in `web/src/app/globals.css`.
- **Prisma 6 + SQLite** (dev, `web/prisma/dev.db`) → Postgres later. **Do not upgrade to Prisma 7** (see [Errors](docs/Errors.md)).
  SQLite has no native enums → enum values live in `web/src/lib/enums.ts`.
- **Auth.js (Google)** planned — but **mock role-based login for now** behind `getCurrentUser()` (see below).
- Email layer = `web/src/lib/notify.ts`; dev transport just `console.log`s + writes a `Notification` row.
- **LLM brain: muapi.ai** — invoice extraction, fuzzy matching, dedupe. Pluggable in `web/src/lib/ai/`
  (`AI_PROVIDER=muapi|anthropic|mock`, `MUAPI_MODEL`). ⚠️ muapi is **async submit-then-poll**, not OpenAI-compatible
  (ADR-006); has a deterministic regex fallback. muapi's Claude proxy was down 2026-07-31 — Gemini worked.

## Where we are (resume here)
Phase 0 + core of Phase 1 + **core of Phase 2 — VERIFIED LIVE end-to-end**. Yuvraj signed in with Google,
scanned Gmail, and a PDF invoice was extracted → matched → validated on the real app. Shipped: LLM brain
(`web/src/lib/ai/`), custom **Google OAuth** (`web/src/lib/google.ts` + `/api/auth/google/*`), **Gmail scanning**
(`web/src/lib/gmail.ts`, inbox-only + noise gate + text-PDF via `web/src/lib/pdf.ts`), **validation engine**
(`web/src/lib/validation.ts`), real **Invoices** screen. Earlier: dashboard, closing sheets, approval workflow,
audit trail, notifications, vendors, theming. Placeholders remain for reimbursements / dispatch / accounts / settings.
**Env (carry forward):** dev on **port 3001** (Google redirect URI registered); `MUAPI_MODEL=gemini-3-flash`
(muapi's Claude proxy was down — revert to `claude-sonnet-4-5` when it recovers); `GMAIL_SCAN_STRICT=true`.
**Next up:** surface scanned invoices on the closing-sheet detail page; image/scanned-PDF (OCR); Phase 1 gaps
(Reimbursements, Accounts mark-paid, Ledger, Dispatch); Phase 2 remainder (GST math, real SMTP, reminders).
Full status: [docs/Roadmap.md](docs/Roadmap.md), [docs/Session Log.md](docs/Session%20Log.md).

## Repo layout
```
prodapp/
  CLAUDE.md              <- you are here
  PRODUCT_BRIEF.md       <- full product spec (source of truth)
  docs/                  <- Obsidian vault (planning, architecture, learnings, errors, decisions)
  reference/             <- the real Revolio invoice format + closing sheet PDFs
  web/                   <- the Next.js app
```

## Commands (run from `web/`)
```bash
npm run dev          # dev server → http://localhost:3000
npm run build        # production build
npx prisma studio    # inspect the DB
npx prisma migrate dev --name <name>   # after editing schema.prisma
npx prisma db seed   # reseed demo data
```

## Current state / auth model
- **Mock auth**: seeded users, switch role via a role picker. Real Google OAuth is stubbed behind the same
  interface (`web/src/lib/auth.ts`) so it drops in when the user supplies Google Cloud credentials.
- Seeded users cover all 4 roles: Producer, Senior Producer, Accounts, Admin.

## Conventions
- Money stored as **integer paise** (avoid float). Display helper `formatINR()`.
- Enums live in Prisma schema; import types from `@/lib/db`.
- Server actions in `web/src/app/**/actions.ts`; never call Prisma from client components.
- Every state-changing action writes an **AuditLog** row.
- Notifications go through `web/src/lib/notify.ts` (one function per trigger in the §7 matrix).

## Working agreement
- Keep [docs/Learnings.md](docs/Learnings.md), [docs/Errors.md](docs/Errors.md), and
  [docs/Decisions.md](docs/Decisions.md) updated as we go — that's what makes future sessions fast.
- When a module ships, tick it in [docs/Roadmap.md](docs/Roadmap.md).

## Open dependencies from the user
- Google Cloud OAuth credentials (for real Gmail scanning + login).
- `MUAPI_API_KEY` for the Claude/LLM brain.
- Accounts team input on GST calc rules + dispatch recipient list.
