# Structure

Folder layout of the app (`web/`). Updated as modules land.

```
web/
  prisma/
    schema.prisma        # all entities (see [[Data Model]])
    seed.ts              # demo users, project, closing sheet, invoices
    dev.db               # sqlite (gitignored)
  src/
    app/
      layout.tsx         # root shell (sidebar nav, role switcher)
      page.tsx           # dashboard
      globals.css
      closing-sheets/
        page.tsx         # list
        new/page.tsx     # create
        [id]/page.tsx    # detail (lines, invoices, approval)
        actions.ts       # server actions (create, submit, approve, reject…)
      reimbursements/    # (later)
      vendors/           # (later)
      dispatch/          # (later)
      accounts/          # (later)
    components/
      ui/                # shadcn primitives (button, card, badge, table…)
      app-sidebar.tsx
      role-switcher.tsx
      status-badge.tsx
      ...
    lib/
      db.ts              # prisma singleton + type/enum re-exports
      auth.ts            # getCurrentUser() — mock now, Auth.js later
      notify.ts          # email trigger functions (§7 matrix)
      money.ts           # formatINR(), paise helpers
      audit.ts           # logAudit()
      ai/                # muapi.ai (Claude) client — matching/extraction (later)
      gmail/             # invoice collection (later)
      pdf/               # manual invoice + dispatch bundle (later)
  .env                   # DATABASE_URL, MUAPI_API_KEY, GOOGLE_* (gitignored)
```

## Naming
- Routes: kebab-case segments. Components: PascalCase files.
- Server actions colocated as `actions.ts` in the route folder.
- Enums come from Prisma; never redefine string unions in the UI.
