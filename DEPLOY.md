# Deploying Revolio (ledger)

**Stack:** Next.js 16 on **Vercel** · **Supabase** Postgres · **Vercel Blob** for files.
It's serverless, so all state lives outside the compute: **data → Supabase**, **uploaded files → Blob**.
Nothing persists on the function's local disk.

Do these four things once, then every push to `main` auto-deploys.

---

## 1. Environment variables (Vercel → Settings → Environment Variables)

| Name | Value / where to get it |
|------|-------------------------|
| `DATABASE_URL` | Supabase → Database → Connection string → **Transaction pooler** (port `6543`). Append `?pgbouncer=true`. Username must be `postgres.<project-ref>`. App runtime uses this. |
| `DIRECT_URL` | Supabase → **Session pooler** (port `5432`), same `postgres.<project-ref>` username. Used by `prisma migrate deploy`. |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | Production URL, e.g. `https://<app>.vercel.app` (no trailing slash) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client |
| `MUAPI_API_KEY` / `MUAPI_BASE_URL` / `MUAPI_MODEL` / `AI_PROVIDER` | muapi.ai (LLM invoice extraction) |
| `GMAIL_SCAN_STRICT` | `true` |
| `NOTIFY_RECIPIENTS` | comma-separated emails |
| `CRON_SECRET` | any random string — Vercel Cron sends it to authenticate the reminders job |
| `BLOB_READ_WRITE_TOKEN` | **auto-injected** when you connect a Blob store (step 3) — don't set by hand |
| `SMTP_URL` *or* `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` | optional; unset = notifications log to console only |
| `PUBLIC_BASE_URL` | optional; reserved for future OCR of image/scanned-PDF invoices |

> **Password encoding:** URL-encode special characters in the DB password (`@` → `%40`, `#` → `%23`, `:` → `%3A`, …).

### Why the pooler (and not the "direct" host) on Vercel
Supabase's direct host `db.<ref>.supabase.co:5432` is **IPv6-only**, and Vercel's build/runtime can't reach IPv6.
Use the **pooler** for both URLs (it's IPv4): transaction pooler (`6543`) for `DATABASE_URL`, session pooler (`5432`)
for `DIRECT_URL`. Both use the `postgres.<project-ref>` username — a bare `postgres` username fails auth on the pooler.

---

## 2. Database (Supabase)

- **Region:** pick one close to your users and match it with the Vercel function region (below). This project uses
  **Mumbai (`ap-south-1`)**.
- **Migrations** run automatically on each deploy — `vercel-build` runs `prisma migrate deploy` against `DIRECT_URL`.
- **Seed** (optional demo data): run `npm run db:seed` locally pointed at the prod DB. Skip for real data.

---

## 3. Vercel

- **Function region** is pinned to `bom1` (Mumbai) in `vercel.json` — keep it equal to the Supabase region so
  function↔DB round-trips stay ~1–5 ms.
- **Blob store:** Storage → Create → **Blob** → connect to the project. This injects `BLOB_READ_WRITE_TOKEN`; after that,
  receipts / manual-invoice attachments / saved Gmail attachments persist in Blob instead of the (ephemeral) disk.
- **Cron:** `vercel.json` calls `GET /api/cron/reminders` daily (09:00 UTC) for the wrap-up reminder + month-end
  escalation. It's gated by `CRON_SECRET`, which Vercel Cron sends automatically once that env var is set.

---

## 4. Google OAuth

Google Cloud Console → Credentials → your OAuth client → **Authorized redirect URIs** → add:

```
https://<your-domain>/api/auth/google/callback
```

Also ensure the `gmail.readonly` scope and your test users are configured. Without the redirect URI, Google sign-in
and Gmail scanning error on the deployed site.

---

## Deploy

1. Set all env vars (§1).
2. Connect a Blob store (§3).
3. Add the Google redirect URI (§4).
4. Push to `main` (or hit **Redeploy**). `vercel-build` = `prisma generate && prisma migrate deploy && next build`.
5. Verify: open the site, sign in with Google, load a few pages, try a scan / an upload.

---

## Local development

- `.env` (gitignored) needs at least `DATABASE_URL` + `DIRECT_URL`. For a long-running `next dev`, the **direct**
  connection (`postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres`) is snappier than the pooler.
- With no `BLOB_READ_WRITE_TOKEN`, uploads go to local `public/uploads/`; with no `SMTP_*`, notifications print to the
  console — both are the intended dev behavior.
- Commands (from `web/`):
  ```bash
  npm run dev                     # http://localhost:3001
  npx prisma migrate dev          # after editing schema.prisma
  npm run db:seed                 # reseed demo data
  ```
- For instant queries, run Postgres locally (e.g. Docker) — same provider and migrations as prod, zero drift.

---

## Security

- `.env` is gitignored — never commit secrets. This repo is public.
- Rotate the Supabase DB password and any API keys that were ever shared in plaintext, then update them in `.env`
  and Vercel.
